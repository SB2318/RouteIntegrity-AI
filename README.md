# RouteIntegrity AI 🚗🛡️

An AI-powered route integrity and fraud detection system that monitors a driver's journey against a user-approved route and identifies suspicious deviations.

## 🎯 Goal

RouteIntegrity AI is designed to answer:

> **"Is the driver actually taking the route that was agreed upon?"**

The system establishes an approved route between a user's source and destination, continuously monitors the driver's GPS location during the trip, and detects significant or suspicious deviations.

## 🔄 How It Works

```text
User
 │
 ├── Start Location
 ├── Destination
 │
 ▼
Backend
 │
 ├── Validate Trip
 ├── Generate Expected Route
 └── Store Approved Route
 │
 ▼
Driver + User Agree
 │
 ▼
Route Detector Enabled
 │
 ▼
Continuous GPS Tracking
 │
 ▼
RouteIntegrity AI
 │
 ├── Monitor Route
 ├── Analyze Deviation
 ├── Detect Suspicious Behavior
 └── Generate Decision
 │
 ▼
LEGITIMATE / SUSPICIOUS / FRAUD
 │
 ▼
High-Risk Incident
 │
 ▼
Authorized Emergency / Police Escalation
```

## 🧠 Detection Pipeline

### 1. `validate_trip`

Validates the source, destination, driver agreement, approved route, and required GPS information before monitoring begins.

### 2. `monitor_route`

Compares the driver's current location and movement with the approved route.

### 3. `analyze_deviation`

Analyzes significant deviations and considers legitimate explanations such as:

* Traffic
* Road closures
* One-way roads
* Road restrictions
* Alternative valid routes

### 4. `fraud_decision`

Classifies the journey as:

* `LEGITIMATE`
* `SUSPICIOUS`
* `FRAUD`

The decision should include confidence, evidence, and recommended action.

### 5. `escalate_incident`

High-risk incidents can be escalated through an authorized backend/emergency integration.

The AI itself should not independently contact authorities.

## 📡 Example Trip

```json
{
  "source": "Kolkata Airport",
  "destination": "Howrah Station",
  "approvedRouteId": "route_123",
  "currentLocation": {
    "lat": 22.5726,
    "lng": 88.3639
  },
  "distanceFromRoute": 850,
  "deviationDuration": 180,
  "movingTowardDestination": false
}
```

Possible result:

```json
{
  "status": "SUSPICIOUS",
  "confidence": 0.91,
  "routeDeviation": true,
  "reason": "Driver has significantly deviated from the approved route and is moving away from the destination.",
  "recommendedAction": "INVESTIGATE"
}
```

## 🏗️ Proposed API

```text
POST /trips
POST /trips/:id/approve-route
POST /trips/:id/start-detector
POST /trips/:id/location
POST /trips/:id/stop-detector
```

The `/location` endpoint receives live GPS updates while the detector is active.

## ⚙️ Architecture Principle

The system should **not send every GPS coordinate directly to the AI**.

Instead:

```text
GPS
 ↓
Backend
 ↓
Map / Route Validation
 ↓
Detect Significant Deviation
 ↓
AI Analysis
 ↓
Fraud Decision
```

Deterministic route calculations should handle straightforward geographic validation, while AI should analyze behavioral patterns and suspicious deviations.

## 🔐 Safety & Privacy

* Route monitoring should only begin after appropriate user/driver agreement.
* GPS data should be transmitted securely.
* Store only information required for the trip and investigation.
* Avoid automatically declaring fraud from a single GPS deviation.
* Emergency escalation should require explicit backend rules and authorized integrations.

## 🚀 Project Status

**Early development**

Current focus:

* [ ] Trip creation
* [ ] Route generation
* [ ] User/driver route agreement
* [ ] GPS tracking
* [ ] Route deviation detection
* [ ] AI fraud analysis
* [ ] Incident management
* [ ] Authorized emergency integration

## 📌 Vision

RouteIntegrity AI aims to provide an additional safety layer for ride-sharing and transportation platforms by detecting route manipulation and unusual driver behavior in real time.

> **Know the route. Monitor the journey. Detect the deviation.**
