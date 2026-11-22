
import json
import boto3
import os
import uuid
import logging
import base64

from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Logging configuration
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB connection
dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("TABLE_NAME", "Tasks")
table = dynamodb.Table(TABLE_NAME)


def response(status_code, body):
    """Create a standard HTTP response."""

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }


def get_request_body(event):
    """Read and decode request body."""

    body = event.get("body") or "{}"

    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")

    return json.loads(body)


def get_task_id(event):
    """Extract task ID from URL path or query string."""

    path = event.get("rawPath", "").rstrip("/")
    parts = path.split("/")

    if len(parts) >= 3 and parts[-2] == "tasks":
        return parts[-1]

    query = event.get("queryStringParameters") or {}

    return query.get("task_id")


def lambda_handler(event, context):

    try:
        method = (
            event.get("requestContext", {})
            .get("http", {})
            .get("method", "GET")
        )

        logger.info("Received request: %s", method)

        # Handle CORS preflight if it reaches Lambda
        if method == "OPTIONS":
            return response(200, {"message": "CORS preflight successful"})

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

            return response(200, {
                "message": "Tasks retrieved successfully",
                "tasks": items
            })

        # POST: Create a new task
        elif method == "POST":

            data = get_request_body(event)

            title = data.get("title", "").strip()

            if not title:
                return response(400, {
                    "error": "Task title is required"
                })

            now = datetime.now(timezone.utc).isoformat()

            task = {
                "task_id": str(uuid.uuid4()),
                "title": title,
                "description": data.get("description", ""),
                "status": "Pending",
                "created_at": now,
                "updated_at": now
            }

            table.put_item(Item=task)

            logger.info("Task created: %s", task["task_id"])

            return response(201, {
                "message": "Task created successfully",
                "task": task
            })

        # PUT: Update an existing task
        elif method == "PUT":

            task_id = get_task_id(event)

            if not task_id:
                return response(400, {
                    "error": "Task ID is required in /tasks/{task_id}"
                })

            data = get_request_body(event)

            allowed_fields = ["title", "description", "status"]

            updates = {
                key: value
                for key, value in data.items()
                if key in allowed_fields
            }

            if not updates:
                return response(400, {
                    "error": "No valid fields provided for update"
                })

            if "title" in updates:
                if not isinstance(updates["title"], str) or not updates["title"].strip():
                    return response(400, {
                        "error": "Title cannot be empty"
                    })

            if "status" in updates:
                if updates["status"] not in [
                    "Pending",
                    "In Progress",
                    "Completed"
                ]:
                    return response(400, {
                        "error": "Invalid task status"
                    })

            updates["updated_at"] = datetime.now(
                timezone.utc
            ).isoformat()

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

                return response(200, {
                    "message": "Task updated successfully",
                    "task": result["Attributes"]
                })

            except ClientError as error:
                if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    return response(404, {
                        "error": "Task not found"
                    })
                raise

        # DELETE: Delete a task
        elif method == "DELETE":

            task_id = get_task_id(event)

            if not task_id:
                return response(400, {
                    "error": "Task ID is required in /tasks/{task_id}"
                })

            try:
                table.delete_item(
                    Key={"task_id": task_id},
                    ConditionExpression="attribute_exists(task_id)"
                )

                logger.info("Task deleted: %s", task_id)

                return response(200, {
                    "message": "Task deleted successfully",
                    "task_id": task_id
                })

            except ClientError as error:
                if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    return response(404, {
                        "error": "Task not found"
                    })
                raise

        else:
            return response(405, {
                "error": "Method not allowed"
            })

    except Exception:
        logger.exception("Task Manager API error")

        return response(500, {
            "error": "Internal server error"
        })
