
import json
import boto3
import os
import uuid
import logging

from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB connection
dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("TABLE_NAME", "Tasks")
table = dynamodb.Table(TABLE_NAME)


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }


def get_request_body(event):
    body = event.get("body") or "{}"
    return json.loads(body)


def normalize_task(item):
    """Convert DynamoDB attributes into frontend format."""

    status = item.get("status", "Pending")

    return {
        "id": item.get("task_id"),
        "title": item.get("title", ""),
        "description": item.get("description", ""),
        "priority": item.get("priority", "medium"),
        "category": item.get("category", "Other"),
        "due": item.get("due", ""),
        "done": status == "Completed",
        "createdAt": item.get("createdAt", 0)
    }


def lambda_handler(event, context):

    try:
        method = (
            event.get("requestContext", {})
            .get("http", {})
            .get("method", "GET")
        )

        logger.info("Received request: %s", method)

        # GET: Fetch all tasks
        if method == "GET":

            items = []
            scan_kwargs = {}

            while True:
                result = table.scan(**scan_kwargs)
                items.extend(result.get("Items", []))

                if "LastEvaluatedKey" not in result:
                    break

                scan_kwargs["ExclusiveStartKey"] = (
                    result["LastEvaluatedKey"]
                )

            tasks = [normalize_task(item) for item in items]

            return response(200, tasks)

        # POST: Create task
        elif method == "POST":

            data = get_request_body(event)

            title = data.get("title", "").strip()

            if not title:
                return response(400, {
                    "message": "Task title is required"
                })

            now = int(datetime.now(timezone.utc).timestamp() * 1000)

            task = {
                "task_id": str(uuid.uuid4()),
                "title": title,
                "description": data.get("description", ""),
                "priority": data.get("priority", "medium"),
                "category": data.get("category", "Other"),
                "due": data.get("due", ""),
                "status": "Pending",
                "createdAt": now
            }

            table.put_item(Item=task)

            logger.info("Task created: %s", task["task_id"])

            return response(201, normalize_task(task))

        # PUT: Update task
        elif method == "PUT":

            data = get_request_body(event)
            task_id = data.get("id")

            if not task_id:
                return response(400, {
                    "message": "Task ID is required"
                })

            updates = {}

            allowed_fields = [
                "title",
                "priority",
                "category",
                "due"
            ]

            for field in allowed_fields:
                if field in data:
                    updates[field] = data[field]

            if "done" in data:
                updates["status"] = (
                    "Completed" if data["done"] else "Pending"
                )

            if not updates:
                return response(400, {
                    "message": "No valid fields to update"
                })

            if "title" in updates:
                if not isinstance(updates["title"], str) or not updates["title"].strip():
                    return response(400, {
                        "message": "Title cannot be empty"
                    })

            expression_names = {}
            expression_values = {}
            update_parts = []

            for index, (key, value) in enumerate(updates.items()):
                name = f"#field{index}"
                val = f":value{index}"

                expression_names[name] = key
                expression_values[val] = value

                update_parts.append(f"{name} = {val}")

            try:
                result = table.update_item(
                    Key={"task_id": task_id},
                    UpdateExpression="SET " + ", ".join(update_parts),
                    ExpressionAttributeNames=expression_names,
                    ExpressionAttributeValues=expression_values,
                    ConditionExpression="attribute_exists(task_id)",
                    ReturnValues="ALL_NEW"
                )

                return response(
                    200,
                    normalize_task(result["Attributes"])
                )

            except ClientError as error:
                if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    return response(404, {
                        "message": "Task not found"
                    })
                raise

        # DELETE: Delete task
        elif method == "DELETE":

            query = event.get("queryStringParameters") or {}
            task_id = query.get("id")

            if not task_id:
                return response(400, {
                    "message": "Task ID is required"
                })

            try:
                table.delete_item(
                    Key={"task_id": task_id},
                    ConditionExpression="attribute_exists(task_id)"
                )

                logger.info("Task deleted: %s", task_id)

                return response(200, {
                    "message": "Task deleted successfully"
                })

            except ClientError as error:
                if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    return response(404, {
                        "message": "Task not found"
                    })
                raise

        else:
            return response(405, {
                "message": "Method not allowed"
            })

    except Exception:
        logger.exception("Task Manager API error")

        return response(500, {
            "message": "Internal server error"
        })
