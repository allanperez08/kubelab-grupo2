# Acceso por VPN (ACC-02)

Para dar acceso a la red del clúster usamos Tailscale con un subnet router en Proxmox. Así el docente puede llegar a Proxmox, a los nodos y a la IP de Traefik desde cualquier red, sin abrir puertos.

## Cómo está armado

```
Docente (Tailscale) ──► pve (subnet router) ──► red del laboratorio 192.168.0.0/24
                                                  ├─ 192.168.0.16   Proxmox
                                                  ├─ 192.168.0.20   control-plane
                                                  ├─ 192.168.0.21   worker-1
                                                  ├─ 192.168.0.22   worker-2
                                                  ├─ 192.168.0.23   worker-3
                                                  └─ 192.168.0.240  Traefik (MetalLB)
```

- Tailscale está instalado solo en el host de Proxmox (`pve`). Las VMs no tienen nada instalado.
- `pve` anuncia la ruta `192.168.0.0/24` a la red de Tailscale (tailnet `allanperez08.github`).
- Cuando un equipo de la VPN quiere llegar a una IP `192.168.0.x`, el tráfico entra por `pve` y este lo reenvía a la VM.

### Por qué no ZeroTier

Primero se configuró ZeroTier, pero en el plan gratuito ya no se pueden crear Managed Routes. Sin esa ruta, el docente tendría que agregarla a mano con `route add` en su computadora. Con Tailscale los subnet routers están en el plan gratuito y en Windows y macOS la ruta se acepta sola. ZeroTier se desinstaló de Proxmox.

## Configuración en Proxmox

Todo se hizo en la consola de `pve` como root.

1. Reenvío de paquetes, para que `pve` funcione como router:

```bash
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-forward.conf
echo "net.ipv6.conf.all.forwarding = 1" >> /etc/sysctl.d/99-forward.conf
sysctl --system
```

2. Instalación de Tailscale y anuncio de la ruta:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --advertise-routes=192.168.0.0/24
```

El comando muestra un enlace para iniciar sesión; se abrió con la cuenta dueña del tailnet.

3. En la consola de administración (login.tailscale.com), en **Machines → pve**:
   - **Edit route settings** → se aprobó `192.168.0.0/24`.
   - **Disable key expiry**, para que `pve` no se desconecte cuando venza la llave.

![Machines](img/tailscale-machines.png)

![Ruta aprobada](img/tailscale-routes.png)

4. Verificación en `pve`:

```bash
tailscale status
```

![tailscale status](img/pve-tailscale-status.png)

## Instrucciones para el docente

1. Aceptar la invitación que llega al correo. Se invita con rol **Member**: puede usar la red, pero no cambiar la configuración.
2. Instalar Tailscale desde https://tailscale.com/download.
3. Iniciar sesión con el correo invitado y, cuando pregunte qué tailnet usar, elegir **allanperez08.github**.
4. Revisar que diga **Connected**.
   - Windows: clic derecho en el ícono de Tailscale y confirmar que esté marcado **Use Tailscale subnets**.
   - macOS: en el menú de Tailscale, **Use Tailscale subnets** activado.
   - Linux: conectarse con `sudo tailscale up --accept-routes`.
5. Probar la conexión:

```
ping 192.168.0.16
ping 192.168.0.20
```

6. Copiar el contenido de [hosts.txt](hosts.txt) al archivo hosts:
   - Windows: `C:\Windows\System32\drivers\etc\hosts` (Bloc de notas como administrador).
   - Linux / macOS: `/etc/hosts` (con `sudo`).

Con eso ya puede abrir los servicios por nombre de dominio (`*.grupo2.lab`). La tabla de URLs está en el README.

## Prueba realizada

Desde una laptop conectada al hotspot de un celular (fuera de la red del laboratorio) y unida al tailnet como Member:

| Destino | Equipo | Resultado |
| :--- | :--- | :--- |
| 192.168.0.16 | Proxmox | responde, TTL 64 |
| 192.168.0.20 | control-plane | responde, TTL 63 |
| 192.168.0.21 | worker-1 | responde, TTL 63 |
| 192.168.0.22 | worker-2 | responde, TTL 63 |
| 192.168.0.23 | worker-3 | responde, TTL 63 |
| https://192.168.0.16:8006 | Interfaz web de Proxmox | carga |

El TTL 63 en las VMs muestra que el tráfico pasa por `pve`, un salto más que Proxmox.

![Pings por VPN](img/vpn-pings.png)

![Proxmox por VPN](img/vpn-proxmox.png)

## Problemas que podrían pasar

| Problema | Qué revisar |
| :--- | :--- |
| No responde ningún ping | Que Tailscale diga Connected y que se haya elegido el tailnet `allanperez08.github` |
| Responde `pve` por su IP 100.x pero no las IPs 192.168.0.x | Que la ruta esté aprobada en la consola y que esté activado Use Tailscale subnets |
| La red local del docente también es 192.168.0.x | Su red local tiene prioridad sobre la VPN. Conectarse desde otra red, por ejemplo el hotspot del celular |
| Se pierden los primeros pings | Normal la primera vez, mientras la red encuentra la VM |
