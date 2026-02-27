# Incident Response Basics

## 1. Severity
- `SEV-1`: Complete outage, data loss risk, or broad auth/security failure.
- `SEV-2`: Major degradation (high 5xx, queue backlog growth, core flow blocked).
- `SEV-3`: Localized issues with workarounds.

## 2. Roles
- Incident Commander: owns decisions and timeline.
- Communications Lead: status updates to stakeholders.
- Operations Lead: executes mitigation and recovery.

## 3. First 15 Minutes
1. Declare incident severity and create an incident channel.
2. Capture timestamps and current impact.
3. Check:
- API process health and recent `RequestTelemetry`
- DB/Redis connectivity
- worker health and `JobTelemetry` failure spikes
4. Apply immediate mitigation:
- rollback recent deploy if needed
- scale down noisy clients via tighter rate limits
- disable non-critical workflows if needed

## 4. Communication Cadence
- `SEV-1`: update every 15 minutes.
- `SEV-2`: update every 30 minutes.
- Include impact, mitigation, ETA confidence.

## 5. Resolution Criteria
- Core user flows restored (`auth`, `projects`, `simulate`, `grade`, `report`).
- Error rates return to baseline.
- Queue failure rates are stable.

## 6. Post-Incident
Within 48 hours:
1. Publish incident summary.
2. Identify root cause and contributing factors.
3. Add corrective actions with owners and due dates.
4. Update runbooks and tests to prevent recurrence.
