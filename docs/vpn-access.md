# VPN Access Instructions (ACC-02 Requirement)

To access the cluster services, you must join our Tailscale network. The Proxmox host acts as a Subnet Router to route traffic seamlessly to the Kubernetes nodes (`192.168.0.0/24`).

1. Install the Tailscale client from [tailscale.com/download](https://tailscale.com/download).
2. Use the Invite Link provided via our private communication channel to join the `kubelab-grupo2` Tailnet.
3. Once joined, ensure the "Use Tailscale subnets" (or similar) option is enabled in your client settings.