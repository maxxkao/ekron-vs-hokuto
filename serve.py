"""Serve the 3D game on your Wi-Fi so a phone on the same network can play it."""
import http.server
import os
import socket
import socketserver

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.glb': 'model/gltf-binary', '.js': 'text/javascript'}

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), H) as httpd:
    ip = lan_ip()
    print('=' * 52)
    print('  EKRON vs HOKUTO 3D')
    print(f'  電腦開啟:  http://localhost:{PORT}')
    print(f'  手機開啟:  http://{ip}:{PORT}   (同一個 Wi-Fi)')
    print('  關閉這個視窗即停止伺服器')
    print('=' * 52)
    httpd.serve_forever()
