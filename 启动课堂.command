#!/bin/zsh
cd "${0:A:h}"
if ! command -v node >/dev/null; then
  print '请先安装Node.js 22.13或更新版本，再打开本文件。'
  read 'reply?按回车退出'
  exit 1
fi
if curl --silent --fail http://localhost:8794/api/classes >/dev/null; then
  open 'http://localhost:8794/teacher'
  print '课堂服务已经在运行。关闭原启动窗口可停止服务。'
  read 'reply?按回车退出这个窗口'
  exit 0
fi
node --no-warnings server.cjs &
lesson_pid=$!
trap 'kill $lesson_pid 2>/dev/null' EXIT INT TERM
for attempt in {1..30}; do
  if curl --silent --fail http://localhost:8794/api/classes >/dev/null; then
    open 'http://localhost:8794/teacher'
    break
  fi
  if ! kill -0 $lesson_pid 2>/dev/null; then
    print '启动失败，请查看上方的提示。'
    read 'reply?按回车退出'
    exit 1
  fi
  sleep 0.2
done
wait $lesson_pid
