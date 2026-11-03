# KubeLab - Group 2

Kubernetes platform on Proxmox with GitOps, observability and centralized secrets.

## Architecture

The physical computer runs Proxmox VE 9.2. Proxmox hosts 4 virtual machines with Ubuntu Server 26.04 LTS that form a k3s cluster. Access from outside the lab network goes through Tailscale, using the Proxmox host as a subnet router. Traefik receives a fixed IP from MetalLB and publishes every service under the `grupo2.lab` domain.

```
Teacher (Tailscale) ──► pve 192.168.0.16 (subnet router) ──► lab network 192.168.0.0/24
                                                              ├─ control-plane  192.168.0.20
                                                              ├─ worker-1       192.168.0.21
                                                              ├─ worker-2       192.168.0.22
                                                              ├─ worker-3       192.168.0.23
                                                              └─ Traefik (MetalLB) 192.168.0.240
```

## Node inventory

| Name | Role | Static IP | CPU (Cores) | Memory (RAM) | Disk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| control-plane | Control Plane | 192.168.0.20 | 4 | 4 GB | 40 GB |
| worker-1 | Worker | 192.168.0.21 | 2 | 2 GB | 20 GB |
| worker-2 | Worker | 192.168.0.22 | 2 | 2 GB | 20 GB |
| worker-3 | Worker | 192.168.0.23 | 2 | 2 GB | 20 GB |

- Proxmox host (`pve`): `192.168.0.16`
- Gateway: `192.168.0.1`
- MetalLB pool: `192.168.0.240` - `192.168.0.250`
- Kubernetes distribution: k3s `v1.30.4+k3s1`

## Repository structure

```
/
├── apps/
│   ├── api/              # API source code and Dockerfile
│   └── web/              # Web application source code and Dockerfile
├── k8s/
│   ├── apps/             # Manifests for api, web and database
│   ├── platform/         # MetalLB, Traefik, storage class, Doppler
│   ├── observability/    # Prometheus, Grafana, Loki, Promtail
│   └── argocd/           # Argo CD Application definitions
├── .github/workflows/    # CI/CD pipelines
├── docs/                 # VM creation, cluster setup, VPN access, diagrams and zone file
└── README.md
```

## Documentation

| Document | Content |
| :--- | :--- |
| [docs/infra-setup.md](docs/infra-setup.md) | Proxmox, lab network and step-by-step VM creation (INF-01 to INF-03, INF-06) |
| [docs/cluster-setup.md](docs/cluster-setup.md) | k3s installation, why k3s and node verification (INF-04, INF-05) |
| [docs/vpn-access.md](docs/vpn-access.md) | VPN with Tailscale and how to access the services (ACC-01, ACC-02) |
| [docs/hosts.txt](docs/hosts.txt) | Zone file to copy into `/etc/hosts` |
| [docs/ia.md](docs/ia.md) | Use of AI tools |

## Rebuilding the environment from scratch

1. Install Proxmox VE and create the 4 VMs: [docs/infra-setup.md](docs/infra-setup.md).
2. Install k3s on the nodes: [docs/cluster-setup.md](docs/cluster-setup.md).
3. Configure the VPN on Proxmox: [docs/vpn-access.md](docs/vpn-access.md).
4. Platform (MetalLB, Traefik, storage, Doppler): pending.
5. Argo CD and applications: pending.

## URL table

All domains point to the Traefik IP (`192.168.0.240`).

| URL | Service | What you should see | Status |
| :--- | :--- | :--- | :--- |
| https://192.168.0.16:8006 | Proxmox VE | Proxmox dashboard with the `pve` node and the 4 VMs | Working |
| http://app.grupo2.lab | Web application | Page to list, create, edit and delete records | Pending |
| http://api.grupo2.lab/health | API | API health response | Pending |
| db.grupo2.lab | Database | Connection from a SQL client | Pending |
| http://grafana.grupo2.lab | Grafana | Dashboard with CPU, memory, replicas, requests and logs | Pending |
| http://prometheus.grupo2.lab | Prometheus | Targets in UP state | Pending |
| http://argocd.grupo2.lab | Argo CD | Applications in Synced and Healthy state | Pending |

## Access

1. Join the VPN and copy the zone file following [docs/vpn-access.md](docs/vpn-access.md).
2. Open the URLs from the table above.

Read-only users for the database, Grafana and Argo CD are shared through a private channel.
