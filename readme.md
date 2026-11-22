# ☁️ AWS Task Manager

**A Serverless Task Management Application | AWS | Python | DevOps**

[![AWS](https://img.shields.io/badge/Cloud-AWS-orange?logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Python](https://img.shields.io/badge/Backend-Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![DynamoDB](https://img.shields.io/badge/Database-DynamoDB-4053D6?logo=amazondynamodb&logoColor=white)](https://aws.amazon.com/dynamodb/)
[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)

---

## 📌 Project Overview

AWS Task Manager is a web-based application that allows users to **create, view, update, and delete tasks**.

The application uses a serverless architecture. The frontend is hosted on **Amazon S3**, the backend runs on **AWS Lambda using Python**, and task information is stored in **Amazon DynamoDB**. **GitHub Actions** is used to automate deployment when changes are pushed to the `main` branch.

**Objective:** To gain practical experience with AWS cloud services, serverless application development, database connectivity, secure access configuration, monitoring, and CI/CD automation.

---

## ✨ Features

| Feature | Description |
|---|---|
| ➕ Create tasks | Add a task with a title and description |
| 📋 View tasks | Retrieve tasks stored in DynamoDB |
| ✏️ Update tasks | Modify task details and status |
| 🗑️ Delete tasks | Remove tasks from the database |
| 🆔 Unique task IDs | Generate IDs using Python UUID |
| 🕒 Timestamps | Record task creation and update times |
| ⚠️ Error handling | Handle invalid requests and application errors |
| 📊 Logging | Capture backend logs using CloudWatch |

---

## 🧰 Technology Stack

| Technology / AWS Service | Purpose |
|---|---|
| HTML, CSS, JavaScript | Frontend |
| Python | Backend |
| Boto3 | Python SDK for AWS |
| Amazon S3 | Static frontend hosting |
| AWS Lambda | Serverless backend execution |
| Amazon DynamoDB | NoSQL database |
| AWS IAM | Identity and access management |
| Lambda Function URL | HTTPS endpoint for backend requests |
| Amazon CloudWatch | Monitoring and error logging |
| GitHub Actions | CI/CD automation |
| GitHub OIDC | Secure AWS authentication |
| Git | Version control |

---

## 🏗️ Architecture

The application uses AWS managed services instead of maintaining a dedicated application server.

```text
                         USER
                           |
                           v
                      Web Browser
                           |
                           v
                    +--------------+
                    |  Amazon S3   |
                    |   Frontend   |
                    +--------------+
                           |
                           v
                 +---------------------+
                 | Lambda Function URL |
                 +---------------------+
                           |
                           v
                    +--------------+
                    |  AWS Lambda  |
                    | Python Backend|
                    +--------------+
                           |
                         Boto3
                           |
                           v
                    +--------------+
                    |  DynamoDB    |
                    |  Tasks Table |
                    +--------------+

                 CI/CD DEPLOYMENT FLOW

 Developer -> GitHub Repository -> GitHub Actions
                                           |
                                           v
                                      GitHub OIDC
                                           |
                                           v
                                         AWS IAM
                                           |
                                  +--------+--------+
                                  |                 |
                                  v                 v
                               Amazon S3        AWS Lambda
                            Frontend deploy   Backend deploy

                              CloudWatch
                         Logs and monitoring
```

---

## ☁️ AWS Services

### 1. Amazon S3 — Frontend Hosting
- Hosts the static frontend files.
- Stores HTML, CSS, and JavaScript assets.
- Provides an S3 static website endpoint.

### 2. AWS Lambda — Backend
- Runs the Python backend without managing a server.
- Processes HTTP requests through a Lambda Function URL.
- Uses Boto3 to communicate with DynamoDB.

### 3. Amazon DynamoDB — Database
- Stores task information.
- Uses `task_id` as the partition key.
- Stores task titles, descriptions, statuses, and timestamps.

### 4. AWS IAM — Access Management
- Controls access to AWS resources.
- Provides the Lambda execution role.
- Provides a separate IAM role for GitHub Actions deployment.

### 5. Amazon CloudWatch — Monitoring
- Collects Lambda execution logs.
- Helps investigate backend errors.
- Provides visibility into function execution.

### 6. Lambda Function URL — Backend Endpoint
- Provides an HTTPS endpoint for the backend.
- Allows the frontend to send requests to Lambda.
- Uses configured CORS settings for browser access.

---

## 🔄 CI/CD Pipeline

GitHub Actions automates deployment when code is pushed to the `main` branch.

1. GitHub Actions checks out the repository.
2. Frontend and backend files are validated.
3. Python syntax is checked.
4. GitHub authenticates with AWS using OIDC.
5. Frontend files are synchronized to Amazon S3.
6. Python backend code is packaged into a ZIP file.
7. Backend code is deployed to AWS Lambda.
8. Configured smoke tests check application availability.

### 🔐 Secure Authentication with GitHub OIDC

GitHub OIDC allows GitHub Actions to assume an AWS IAM role and obtain temporary credentials.

This avoids storing long-lived AWS access keys in GitHub repository secrets. The IAM trust policy can restrict access to the intended repository and branch.

---

## 📁 Project Structure

```text
AWS-task-manager/
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── backend/
│   └── lambda_function.py
│
├── Frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
└── README.md
```

---

## 🔧 Backend Operations

The Python Lambda backend supports these CRUD operations:

| HTTP Method | Operation | Purpose |
|---|---|---|
| `GET` | Read | Retrieve tasks |
| `POST` | Create | Add a new task |
| `PUT` | Update | Modify an existing task |
| `DELETE` | Delete | Remove a task |

Each task record contains a unique ID, title, description, status, creation timestamp, and update timestamp.

---

## 🧩 Challenges Faced & Solutions

Building and deploying this project involved troubleshooting practical AWS and DevOps issues.

### 1. IAM Permission Configuration

**Challenge:** Configuring the correct permissions for Lambda to access DynamoDB and write logs to CloudWatch required understanding IAM execution roles and service permissions.

**Solution:** Used a dedicated Lambda execution role with the permissions required by the application.

### 2. GitHub Actions OIDC Authentication

**Challenge:** The initial deployment failed with the error:

```text
Not authorized to perform sts:AssumeRoleWithWebIdentity
```

The issue involved the IAM role's trust relationship and GitHub repository identity.

**Solution:** Reviewed and corrected the OIDC trust policy, including the repository owner, repository name, branch, and audience.

### 3. Python and Node.js Runtime Mismatch

**Challenge:** The initial backend files were written in JavaScript while the Lambda function was configured with a Python runtime.

**Solution:** Standardized the backend on Python and Boto3, and aligned the Lambda handler with the Python module and function name.

### 4. Git Staging and Commit Workflow

**Challenge:** A workflow-file change was not included in a commit because it had not been staged.

**Solution:** Followed the correct Git sequence: stage the changes, commit them, and push the commit to the remote repository.

### 5. File Path and Case-Sensitivity

**Challenge:** The frontend folder was named `Frontend`, while some workflow commands referred to it as `frontend`. GitHub-hosted Linux runners treat these as different paths.

**Solution:** Updated the workflow to use the exact folder capitalization used in the repository.

### 6. AWS Cost Constraints

**Challenge:** The available promotional AWS credits had been exhausted, so unnecessary infrastructure and usage needed to be avoided.

**Solution:** Focused on managed serverless services and avoided adding infrastructure such as EC2 instances and NAT Gateways. Actual AWS charges can still apply depending on service usage, storage, requests, and data transfer.

---

## 🎓 Learning Outcomes

Through this project, I gained practical experience in:

- Serverless application architecture.
- Static website hosting using Amazon S3.
- Python backend development using AWS Lambda.
- Database integration using DynamoDB and Boto3.
- IAM roles, trust policies, and least-privilege access.
- GitHub Actions and automated deployment.
- Secure AWS authentication using GitHub OIDC.
- CloudWatch logging and troubleshooting.
- Git version control and repository management.
- Cost-aware selection of cloud services.

---

## 🚀 Future Enhancements

- Add user authentication and authorization.
- Improve frontend validation and user experience.
- Implement automated database backups and recovery.
- Add automated application testing.
- Introduce Infrastructure as Code using AWS SAM or CloudFormation.
- Configure CloudWatch alarms and more detailed monitoring.

---

## 👩‍💻 Author

**Shristi Dimri**  
B.Tech — Computer Science and Engineering

**Areas of Interest:** Cloud Computing | AWS | DevOps | Automation


