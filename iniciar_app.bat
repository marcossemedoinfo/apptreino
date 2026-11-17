@echo off
title AppTreino 3D - Servidor Local
echo Iniciando AppTreino 3D na porta 8090...
start http://localhost:8090
python -m http.server 8090
