# Use of AI tools

Declaration required by the course guidelines: which tool was used, for what purpose and where. Every team member can explain any file listed here.

## Tool

| Tool | Provider | Period |
| :--- | :--- | :--- |
| Claude (chat / Claude Code session) | Anthropic | 4 and 5 November 2026, last stretch of the project |

Commits made with its help carry a `Co-Authored-By: Claude` line in the history.

## Why we used it

- **Time and a blocking failure.** The database was the last piece missing and we could not get it working: the PostgreSQL pod showed `Running` but had no logs and refused every connection, so the web application could not save data. Several fixes in the manifests (init container, `PGDATA`, new PVC, hardcoded credentials) changed nothing.
- **Diagnosis, not just a patch.** We used the assistant to reason about the symptoms, to propose isolated tests, and to explain the root cause so we could reproduce and defend it.
- **Finishing the CRUD and the observability requirements** (`PUT`/`DELETE`, metrics, dashboard) and to review the repository against the project requirements.

## How it was used

The assistant had **no access** to the cluster, Proxmox, Doppler, GitHub secrets or the VPN. It worked on a copy of the repository and on the text we pasted. We ran every command on the control plane and on `worker-1` ourselves, and every change reached `main` through a pull request merged by a team member.

| Area | What the assistant did | Files | How it was checked |
| :--- | :--- | :--- | :--- |
| PostgreSQL not starting | Found the root cause: on `worker-1` (Ubuntu 26.04, kernel 7.0) the default AppArmor profile of containerd (`cri-containerd.apparmor.d`) denies signals between processes of the same container. `gosu` stayed at 100 % CPU without logs and `pg_ctl` failed with `Permission denied`. Fix: `appArmorProfile: Unconfined` only on the Postgres pod, plus startup/readiness/liveness probes. | `k8s/apps/database/postgres.yaml` | We ran isolated test pods and read `dmesg` (`apparmor="DENIED" operation="signal" ...`); after the merge Postgres started and the application saved data. |
| API CRUD and metrics | Added `PUT`/`DELETE`, input validation, error handling, `http_requests_total` and `http_request_duration_seconds`, and unit tests. | `apps/api/index.js`, `apps/api/test/api.test.js`, `apps/api/package.json`, `apps/api/.dockerignore` | `npm test` (6 tests) runs in the pipeline before every image build. |
| Pipeline | Test step before building the API image. | `.github/workflows/api-ci.yaml` | Runs on every push to `main` that touches `apps/api/`. |
| Web application | Show API errors instead of breaking, render names as text (no HTML injection), edit with the current name preloaded. | `apps/web/index.html` | Run against the real API code in a simulated browser (create, edit, delete, API down, no HTML injection) before the merge. |
| Observability | `ServiceMonitor` so Prometheus scrapes the API, Grafana dashboard as code (replicas, PostgreSQL state, CPU, memory, requests per second, latency, logs). | `k8s/observability/api-servicemonitor.yaml`, `k8s/observability/dashboard.yaml`, `k8s/apps/api.yaml` | PromQL queries parsed for syntax before the merge. |
| Review | Compared the repository with the project requirements and listed what was missing. | this file | Read by the team. |

## Scope

- This declaration covers the Claude sessions described above. The infrastructure (Proxmox, VMs, k3s, Tailscale, MetalLB, Traefik, Argo CD, Doppler) and the repository structure were set up by the team before these sessions; see the commit history.
- Executing, testing and merging every change was done by the team.
- No credential was pasted into the conversation; the assistant only saw what is in the public repository.

## Documentation and network guidance

Claude (Anthropic) was also used through the Claude desktop app by Karla Lopez to help with the VPN choice (ZeroTier vs. Tailscale), the configuration of the TRENDnet router for the defense, and to write and organize the README and the files in `docs/`. The screenshots were taken by the team; the assistant renamed them and hid private data (k3s node token, Tailscale login link). The team reviewed the text before every pull request.

## Short explanation for the defense

1. Symptom: PostgreSQL `Running`, empty logs, `ECONNREFUSED` from the API.
2. Evidence: `ps aux` showed `gosu` at 100 % CPU and no `postgres` process; `dmesg` on the node showed AppArmor `DENIED` for `operation="signal"`.
3. Cause: the AppArmor profile applied by containerd blocks signals inside the container on this Ubuntu version; the PostgreSQL image needs them (`gosu` to switch user, `pg_ctl` to stop the temporary server during initialization).
4. Fix: remove the AppArmor profile only from that pod (`securityContext.appArmorProfile.type: Unconfined`); the rest of the cluster keeps the default profile.
