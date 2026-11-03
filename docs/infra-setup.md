# Creación de la infraestructura (INF-01 a INF-03)

## Proxmox

Proxmox VE 9.2 está instalado directo sobre la computadora física, con IP fija `192.168.0.16` en el bridge `vmbr0` y gateway `192.168.0.1`. La interfaz web está en `https://192.168.0.16:8006`.

Como no tenemos suscripción, se desactivaron los repositorios enterprise para que `apt update` funcione con los repos de Debian:

```bash
cd /etc/apt/sources.list.d/
mv pve-enterprise.sources pve-enterprise.off
mv ceph.sources ceph.off
apt update
```

![apt update](img/pve-repos.png)

## Creación de cada VM

Las 4 VMs se crearon igual desde **Create VM**, solo cambian el nombre, el ID, los recursos y la IP. Capturas de la VM 100 (control-plane):

1. **General:** nodo `pve`, VM ID y nombre.
   ![General](img/vm-wizard-general.png)
2. **OS:** ISO de Ubuntu Server 26.04 LTS desde `local (pve)`, tipo Linux.
   ![OS](img/vm-wizard-os.png)
3. **System:** valores por defecto.
   ![System](img/vm-wizard-system.png)
4. **Disks:** 40 GB para el control-plane, 20 GB para los workers, en `local-lvm`.
   ![Disks](img/vm-wizard-disks.png)
5. **CPU:** 4 núcleos para el control-plane, 2 para los workers.
   ![CPU](img/vm-wizard-cpu.png)
6. **Memory:** 4096 MB para el control-plane, 2048 MB para los workers.
   ![Memory](img/vm-wizard-memory.png)
7. **Network:** bridge `vmbr0`, modelo VirtIO.
   ![Network](img/vm-wizard-network.png)
8. **Confirm:** se revisó el resumen y se creó la VM.
   ![Confirm](img/vm-wizard-confirm.png)

## Instalación de Ubuntu e IP fija

En la instalación de Ubuntu Server se configuró la red en IPv4 manual:

| Nodo | IP | Máscara | Gateway | DNS |
| :--- | :--- | :--- | :--- | :--- |
| control-plane | 192.168.0.20 | /24 | 192.168.0.1 | 8.8.8.8 |
| worker-1 | 192.168.0.21 | /24 | 192.168.0.1 | 8.8.8.8 |
| worker-2 | 192.168.0.22 | /24 | 192.168.0.1 | 8.8.8.8 |
| worker-3 | 192.168.0.23 | /24 | 192.168.0.1 | 8.8.8.8 |

También se instaló OpenSSH Server en todos los nodos.

Para verificar en cada nodo:

```bash
ip -br a
cat /etc/netplan/*.yaml
```

| Nodo | Hardware en Proxmox | IP fija |
| :--- | :--- | :--- |
| control-plane | ![](img/vm-100-hardware.png) | ![](img/vm-100-ip.png) |
| worker-1 | ![](img/vm-101-hardware.png) | ![](img/vm-101-ip.png) |
| worker-2 | ![](img/vm-102-hardware.png) | ![](img/vm-102-ip.png) |
| worker-3 | ![](img/vm-103-hardware.png) | ![](img/vm-103-ip.png) |
