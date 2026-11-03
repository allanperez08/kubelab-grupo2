# Infrastructure Setup Steps (INF-03 Requirement)

1. Uploaded the Ubuntu Server 26.04 LTS (64-bit) ISO to the Proxmox local storage (`local (pve)`).
2. Created 4 VMs using the Proxmox UI (`Create VM`) for the Kubernetes cluster.
3. Selected the uploaded Ubuntu ISO as the installation media for all nodes.
4. Allocated disk size, CPU cores, and memory according to the node inventory table in the README.
5. Retained default network bridge settings (`vmbr0`).
6. Configured manual IPv4 settings during Ubuntu Server installation to assign static IPs matching the `192.168.0.0/24` subnet:
   - `control-plane`: 192.168.0.20
   - `worker-1`: 192.168.0.21
   - `worker-2`: 192.168.0.22
   - `worker-3`: 192.168.0.23
7. Installed OpenSSH server on all nodes for remote access.
8. Started all 4 VMs successfully.

9. **VPN & Routing Setup (Tailscale):**
   - Installed Tailscale directly on the Proxmox physical host.
   - Enabled IP forwarding (`net.ipv4.ip_forward=1`).
   - Configured Proxmox as a Subnet Router: `tailscale up --advertise-routes=192.168.0.0/24`.
   - Approved the subnet route in the Tailscale admin console, allowing any VPN client to reach the internal VM IPs directly without manual routing.