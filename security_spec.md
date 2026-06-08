# Security Specification: Employee Registry

This document outlines the security invariants, malicious payload testing, and design patterns used to secure the Firebase Firestore employee data collection.

## 1. Data Invariants

1. **Authentication Gate**: Any data read or write operation MUST require the user to be signed in. Writes MUST require a verified email (`request.auth.token.email_verified == true`).
2. **Relational Ownership**: An employee record can only be updated or deleted by its creator (`resource.data.createdBy == request.auth.uid`).
3. **Immutability Invariant**: The fields `createdAt` and `createdBy` must remain immutable after document creation.
4. **Strict Schema**: No unregistered fields ("Ghost Fields") are permitted.
5. **Exact Timestamps**: Standard temporal values like `createdAt` (on build/create) and `updatedAt` (on update) must strictly leverage `request.time`.
6. **Integrity Validation**: Field boundaries must be strictly enforced. Employee names and other string fields are limited to logical size constraints to counter Denial of Wallet (DoW) attacks.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads attempt to bypass client validations or exploit database write loops.

### Payload 1: Anonymous Write (Identity Breach)
* **Goal**: Write a record without being authenticated.
* **Payload**:
  ```json
  {
    "name": "Hacker Doe",
    "role": "Adversary",
    "department": "Security",
    "email": "hacker@evil.com",
    "phone": "0812345678",
    "status": "Active",
    "joinedAt": "2026-05-25T00:00:00Z",
    "createdBy": "some_fake_id",
    "createdAt": "2026-05-25T00:00:00Z"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED`

### Payload 2: Creator Spoofing (Impersonation)
* **Goal**: Authenticated user `user_abc` attempts to register an employee under `createdBy: "user_victim_xyz"`.
* **Payload**:
  ```json
  {
    "name": "Jane Impostor",
    "role": "Spy",
    "department": "HR",
    "email": "jane@company.com",
    "phone": "081223344",
    "status": "Onboarding",
    "joinedAt": "2026-05-25T00:00:00Z",
    "createdBy": "user_victim_xyz",
    "createdAt": "REQUEST_TIME"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (createdBy must match request.auth.uid)

### Payload 3: Unverified Email Write (Trust Bypass)
* **Goal**: Authenticated user with `email_verified: false` attempts to write.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 4: Ghost Fields / Privilege Elevation Injection
* **Goal**: Inject unauthorized variables like `isAdmin: true` or `salary` to standard employee record.
* **Payload**:
  ```json
  {
    "name": "Admin Wannabe",
    "role": "Analyst",
    "department": "Finance",
    "email": "wannabe@company.com",
    "phone": "0811223344",
    "status": "Active",
    "joinedAt": "2026-05-25T00:00:00Z",
    "createdBy": "user_abc",
    "createdAt": "REQUEST_TIME",
    "isAdmin": true,
    "salary": 100000000
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (Keys do not match schema exact keys and size)

### Payload 5: Missing Required Fields (Schema Malformation)
* **Goal**: Post a record with missing metadata.
* **Payload**:
  ```json
  {
    "name": "Broken Data"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED`

### Payload 6: Status Value Poisoning
* **Goal**: Put an arbitrary string into restricted `status` enum field (e.g. `"SuperBoss"`).
* **Payload**:
  ```json
  {
    "name": "Budi Bad",
    "role": "General",
    "department": "R&D",
    "email": "budi@company.com",
    "phone": "+628111222",
    "status": "SuperBoss",
    "joinedAt": "2026-05-25T04:00:00Z",
    "createdBy": "user_abc",
    "createdAt": "REQUEST_TIME"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (Status must be 'Active', 'Onboarding', or 'Suspended')

### Payload 7: Immortality Violation (Updating Immutable Creator)
* **Goal**: Update. Change the original creator identifier.
* **Payload (Update)**:
  ```json
  {
    "createdBy": "user_malicious_new"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED`

### Payload 8: Value Poisoning (Denial of Wallet payload)
* **Goal**: Inputting a 2MB string into `name` or `phone` field.
* **Payload**:
  ```json
  {
    "name": "A[2,000,000 characters]...",
    "role": "Staff",
    "department": "IT",
    "email": "staff@company.com",
    "phone": "123",
    "status": "Active",
    "joinedAt": "2026-05-25T00:00:00Z",
    "createdBy": "user_abc",
    "createdAt": "REQUEST_TIME"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (string sizes must be capped)

### Payload 9: Rogue Path Poisoning
* **Goal**: Creating an employee with ID containing malicious dynamic characters or paths (e.g., `../admins/someUid`).
* **Expected Result**: `PERMISSION_DENIED`

### Payload 10: Client Timestamps Manipulation
* **Goal**: Set `createdAt` to a historical date inside the payload.
* **Payload**:
  ```json
  {
    "name": "Spoofed Date",
    "role": "Hacker",
    "department": "IT",
    "email": "h@company.com",
    "phone": "+123",
    "status": "Onboarding",
    "joinedAt": "2026-05-25T00:00:00Z",
    "createdBy": "user_abc",
    "createdAt": "2020-01-01T00:00:00Z"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (`createdAt` must match request.time)

### Payload 11: Cross-user Modification (Hijacking)
* **Goal**: `user_xyz` tries to change an employee record owned by `user_abc`.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 12: Blanket Unsecured List Querying
* **Goal**: Attacking Firestore by grabbing all data without verification constraints.
* **Expected Result**: `PERMISSION_DENIED`
