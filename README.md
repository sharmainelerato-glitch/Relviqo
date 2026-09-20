# Relviqo

**Reliability, measured.**

## Live Demo

🌐 **Live App:** https://relviqo.vercel.app  
⚙️ **API:** https://relviqo-api.onrender.com

> The backend is hosted on Render's free tier, so the first request may take a little longer if the service has been inactive.

Relviqo is an API reliability and performance monitor I built to make it easier to see what is happening with your endpoints at a glance.

Instead of manually checking whether an API is responding, Relviqo can check endpoints, record response times and HTTP status codes, track uptime, and create incidents when something goes wrong.

When an endpoint recovers, Relviqo detects that too and resolves the incident automatically.

---

## Why I built it

I wanted to build something that went beyond a typical CRUD application and gave me practical experience with APIs, networking concepts, background jobs, monitoring, failure detection, and incident handling.

Relviqo became my way of bringing those pieces together into one project.

It also gave me the chance to think about something that matters in real systems: knowing when a service is healthy, when its performance is getting worse, and when something has actually failed.

---

## What Relviqo can do

- Monitor HTTP API endpoints
- Perform GET and HEAD requests
- Check endpoints automatically at scheduled intervals
- Run checks manually when needed
- Measure API response times
- Validate expected HTTP status codes
- Classify endpoints as UP, DEGRADED or DOWN
- Calculate uptime percentages
- Keep historical check results
- Visualise recent endpoint health with heartbeat bars
- Automatically create incidents when endpoints fail
- Automatically resolve incidents when endpoints recover
- Track ongoing and resolved incidents
- Pause and resume monitoring
- Edit monitor configurations
- Delete monitors and their recorded history
- Search monitored endpoints
- View endpoint-specific performance history

---

## How it works

The basic monitoring flow looks like this:

```text
API Endpoint
     ↓
Scheduled / Manual Check
     ↓
HTTP Request
     ↓
Status Code + Response Time
     ↓
Reliability Classification
     ↓
UP / DEGRADED / DOWN
     ↓
History + Metrics + Incident Tracking
```

A successful response with acceptable latency is marked **UP**.

A successful response that takes longer than the configured performance threshold is marked **DEGRADED**.

An unexpected HTTP status or failed request is marked **DOWN**.

If an endpoint goes down, Relviqo creates an incident. Once that endpoint becomes healthy again, the open incident is automatically resolved.

---

## Tech stack

### Frontend

- React
- Vite
- JavaScript
- CSS
- Lucide React

### Backend

- Python
- Flask
- Flask-SQLAlchemy
- APScheduler
- Requests
- SQLite

---

## The dashboard

Relviqo uses a monitoring-console style interface rather than a traditional admin dashboard.

The dashboard gives a quick view of:

- monitored endpoints
- average uptime
- average response time
- total checks
- incidents
- current endpoint status
- recent heartbeat history

Each endpoint also has its own detailed view where its check history and response-time behaviour can be inspected.

---

## Incident tracking

One of my favourite parts of this project is the incident lifecycle.

When Relviqo detects that an endpoint has gone down, it creates an incident and records when the failure started.

When a later check confirms that the endpoint has recovered, Relviqo automatically closes that incident and records the recovery time.

This means the application doesn't just show whether something is currently working. It also keeps a history of when things went wrong.

---

## Running Relviqo locally

### 1. Clone the repository

```bash
git clone https://github.com/sharmainelerato-glitch/Relviqo.git
cd Relviqo
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv
```

On Windows:

```bash
.venv\Scripts\activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Start the Flask API:

```bash
python app.py
```

The backend will run locally on:

```text
http://127.0.0.1:5000
```

### 3. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The terminal will show the local address for the frontend.

---

## API configuration

During local development, the frontend connects to:

```text
http://127.0.0.1:5000/api
```

For deployment, the backend URL can be configured with:

```text
VITE_API_URL
```

---

## What I learned

Relviqo taught me a lot more than simply sending requests to an API.

While building it, I worked with:

- HTTP requests and status codes
- response-time measurement
- API failure handling
- scheduled background jobs
- relational database models
- REST API development
- frontend and backend integration
- uptime calculations
- historical monitoring data
- incident lifecycle logic
- asynchronous system behaviour
- debugging full-stack applications

One of the most useful parts was testing actual failure and recovery scenarios instead of only designing the happy path.

I deliberately tested endpoints with incorrect expected status codes, watched Relviqo detect the failure and create an incident, corrected the configuration, and then verified that the endpoint recovered and the incident was resolved.

---

## A small note

Relviqo is a portfolio project built to explore API monitoring and reliability engineering concepts.

The current version uses SQLite and runs its scheduler as part of the backend application. Depending on where it is hosted, free hosting services may sleep when inactive, which means scheduled checks may pause while the service is asleep.

For a production monitoring service, I would move persistent monitoring data to a production database and run scheduled monitoring through infrastructure designed for continuous background workloads.

---

## What's next?

For now, Relviqo does what I built it to do: monitor endpoints, measure their reliability, and make failures easier to understand.



---

Built by **Lerato Mokgatla**.