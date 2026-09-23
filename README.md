TaskManagement

A full-stack task and project management system for managing workspaces, projects, teams, tasks, permissions, notifications, and day-to-day collaboration through Web and Mobile applications.

This repository contains the Backend, Angular Web Application, React Native Mobile Application, Entity Framework Core migrations, and project documentation.

Overview

TaskManagement provides a centralized environment for organizing and tracking work.

Users can manage workspaces and projects, manage members, create and assign tasks, track task status and progress, collaborate through comments and attachments, receive notifications, and review activity across the system.

The project also includes role-based access control, user-specific permissions, administrative tools, task reminders, and real-time notifications.

Main Features

Workspace management

Project management

Project member management

Task creation and tracking

Task assignment

Task status and progress management

Task comments

Task attachments

Activity logging

Real-time notifications

Task reminders

User account management

JWT authentication

Role and permission management

User-specific permissions

Administrative dashboard

Password recovery

Responsive Angular web application

React Native mobile application

Dark and light themes

Technology Stack

Backend

ASP.NET Core

C#

Entity Framework Core

SQL Server

JWT Authentication

SignalR

Hosted Background Services

REST API

Web Frontend

Angular

TypeScript

HTML

SCSS

RxJS

Mobile Application

React Native

Expo

TypeScript

Database

Microsoft SQL Server

Entity Framework Core Migrations

Repository Structure

TaskManagement/
|
+-- Backend/
|   +-- TaskManagement.API/
|   +-- TaskManagement.Application/
|   +-- TaskManagement.Domain/
|   +-- TaskManagement.Infrastructure/
|
+-- Frontend/
|
+-- Mobile/
|
+-- Docs/
|
+-- .gitignore
+-- README.md

Backend Architecture

TaskManagement.API

Contains the API entry point and HTTP layer, including controllers, API endpoints, authentication configuration, dependency injection, startup configuration, background services, and SignalR configuration.

TaskManagement.Application

Contains DTOs, service interfaces, application services, business logic, permission handling, notification logic, and the application-level operations for workspaces, projects, tasks, and administration.

TaskManagement.Domain

Contains the core domain entities and models used by the system.

TaskManagement.Infrastructure

Contains Entity Framework Core, ApplicationDbContext, database migrations, entity configurations, persistence, and identity/authentication infrastructure.

Prerequisites

Install the tools required by the part of the system you want to run.

Backend

.NET SDK

SQL Server

SQL Server Management Studio or another SQL Server client

Web Frontend

Node.js

npm

Angular CLI

Mobile

Node.js

npm

Expo tooling

Expo Go or an Android/iOS emulator

General

Git

Visual Studio, Visual Studio Code, or another compatible IDE

Clone the Repository

git clone https://github.com/kasem047/TaskManagement.git
cd TaskManagement

The repository contains three main applications:

Backend
Frontend
Mobile

Each application is configured and started separately.

Backend Setup

1. Open the Backend Directory

cd Backend

2. Restore .NET Dependencies

dotnet restore

3. Configure SQL Server

Configure the local SQL Server connection information in the ASP.NET Core configuration used by the API.

Do not commit real production credentials, database passwords, JWT secrets, API keys, or private keys to the repository.

4. Apply Database Migrations

Migrations are stored under:

Backend/TaskManagement.Infrastructure/Data/Migrations/

From the Backend directory, a typical command for this solution structure is:

dotnet ef database update --project TaskManagement.Infrastructure --startup-project TaskManagement.API

If dotnet ef is unavailable:

dotnet tool install --global dotnet-ef

Then run the database update command again.

5. Run the Backend API

dotnet run --project TaskManagement.API

Keep the API running while using the Web or Mobile applications.

Web Frontend Setup

1. Open the Frontend Directory

From the repository root:

cd Frontend

2. Install Dependencies

npm install

3. Configure the Backend API URL

Angular environment configuration is located under:

Frontend/src/environments/

The repository currently contains:

environment.ts
environment.production.ts

Make sure the configured API URL points to the backend instance you are running.

4. Start the Angular Application

npm start

If required by your Angular setup, you can also use:

ng serve

Open the local URL displayed in the terminal.

Mobile Application Setup

1. Open the Mobile Directory

From the repository root:

cd Mobile

2. Install Dependencies

npm install

3. Configure the API

Mobile API-related configuration is located in:

Mobile/src/config.ts

Make sure the mobile application points to an API address that can be reached by the device or emulator.

Important: localhost on a physical phone refers to the phone itself, not the development computer.

The local Mobile .env file is intentionally excluded from Git. Do not commit secrets inside .env.

4. Start Expo

npx expo start

You can then run the application using Expo Go or a supported emulator/simulator.

Authentication and Authorization

The system uses JWT-based authentication.

Authorization is based on roles and permissions and is applied across system operations, including administrative access, workspace access, project access, project membership, role permissions, and user-specific permissions.

Workspace Management

Workspaces are the main organizational containers in the system and can contain members and projects.

Project Management

Projects belong to workspaces and support project-member management, project access control, and project-related tasks.

Task Management

Task functionality includes:

Task creation

Assignment

Status tracking

Progress tracking

Due dates

Comments

Attachments

Activity history

Notifications

Reminders

Notifications

The system contains a notification infrastructure for important system activities.

SignalR is used to support real-time notification behavior in the Web application.

Background Services

The backend contains background processing for task reminders.

Administrative Functionality

Administrative functionality includes areas such as:

Users

Roles

Permissions

User-specific permissions

Password recovery

Administrative dashboard information

Administrative routes and operations are protected by authorization rules.

Web Application

The Angular application includes interfaces for major system areas such as:

Login

Dashboard

Workspaces

Projects

Tasks

Team management

Notifications

Activity logs

User account

Administration

Roles and permissions

Mobile Application

The React Native application includes screens and components related to:

Login

Home

Projects

Managed projects

Project members

Tasks

Task board

Task details

Team

Notifications

Account

Administration

Role-based dashboards

Configuration Notes

Before running the project on another computer, verify:

Backend database connection
Backend authentication configuration
Backend API URL
Frontend API URL
Mobile API URL
Local environment variables

Sensitive values should remain outside Git whenever possible.

Files Intentionally Excluded from Git

Examples include:

node_modules/
bin/
obj/
.env
.expo/
deploy/
build output
local IDE files
deployment archives

These files are generated locally or may contain machine-specific or sensitive information.

Database Migrations

After cloning the project and configuring SQL Server, apply the migrations before using the application.

Migrations are located in:

Backend/TaskManagement.Infrastructure/Data/Migrations/

Development Workflow

A typical local setup flow is:

1. Clone the repository
2. Configure the Backend
3. Configure SQL Server
4. Apply Entity Framework Core migrations
5. Start the Backend API
6. Configure and start the Angular Frontend
7. Configure and start the Mobile application

High-level runtime relationship:

SQL Server
    |
    v
ASP.NET Core Backend API
    |
    +------ Angular Web Application
    |
    +------ React Native Mobile Application

Git Workflow

Before starting new work:

git pull origin main

After making changes:

git status
git add .
git commit -m "Describe the changes"
git push origin main

For larger changes, use a feature branch:

git checkout -b feature/example-feature

Then:

git add .
git commit -m "Add example feature"
git push origin feature/example-feature

Security Notes

Because this is a public repository, never commit:

SQL Server passwords

Production connection strings

JWT signing secrets

API keys

Private keys

Personal access tokens

.env files containing secrets

Production credentials

If a secret is accidentally committed, removing it from the latest file is not enough because it may remain in Git history. Rotate the compromised secret immediately.

Troubleshooting

Backend does not connect to SQL Server

Verify:

SQL Server is running

The connection string is correct

The configured SQL Server instance exists

The database user has the required permissions

Entity Framework Core migrations were applied

Frontend cannot communicate with the Backend

Verify:

The Backend API is running

The Angular environment contains the correct API URL

The configured port is correct

CORS configuration allows the Web application

HTTP/HTTPS configuration matches the Backend

Mobile cannot communicate with the Backend

Verify:

The API is running

Mobile/src/config.ts contains the correct API address

The phone or emulator can reach the backend machine

The development computer and phone are on an accessible network

A physical phone is not configured to use localhost for the development computer

Angular dependencies are missing

Run:

npm install

inside Frontend/.

Mobile dependencies are missing

Run:

npm install

inside Mobile/.

Database model is outdated

From Backend/:

dotnet ef database update --project TaskManagement.Infrastructure --startup-project TaskManagement.API

Documentation

Additional documentation is available in:

Docs/

Project Status

The repository contains the current Backend API, Angular Web application, React Native Mobile application, SQL Server persistence layer, authentication and authorization functionality, workspace/project/task management, notifications, activity logging, and administrative functionality.

Handoff Notes

This repository is intended to contain the source code required to continue development of TaskManagement.

After cloning the project on a new computer, the main items that must be configured locally are:

1. SQL Server connection
2. Backend local configuration
3. Database migrations
4. Frontend API URL
5. Mobile API URL
6. Required local environment variables

Generated dependencies and build artifacts are intentionally not included and must be restored locally.

License

The Mobile project currently contains its own license file.

Before redistributing or licensing the complete TaskManagement repository, define the licensing terms that should apply to the repository as a whole.