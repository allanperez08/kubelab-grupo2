# KubeLab - Grupo 2

## Arquitectura

### Node Inventory (Proxmox Infrastructure)

| Name | Role | Static IP | CPU (Cores) | Memory (RAM) | Disk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| control-plane | Control Plane | Pending | 4 | 4 GB | 40 GB |
| worker-1 | Worker | Pending | 2 | 2 GB | 20 GB |
| worker-2 | Worker | Pending | 2 | 2 GB | 20 GB |
| worker-3 | Worker | Pending | 2 | 2 GB | 20 GB |

**Step-by-step VM Creation (INF-03 Requirement):**
1. Uploaded the Ubuntu Server 26.04 LTS (64-bit) ISO to the Proxmox local storage (`local (pve)`).
2. Created 4 VMs using the Proxmox UI (`Create VM`) for the Kubernetes cluster.
3. Selected the uploaded Ubuntu ISO as the installation media for all nodes.
4. Allocated disk size, CPU cores, and memory according to the node inventory table above.
5. Retained default network bridge settings (`vmbr0`).
6. Started all 4 VMs successfully.


## Pasos para reconstruir el entorno desde cero
## Tabla de URLs
## Instrucciones de acceso