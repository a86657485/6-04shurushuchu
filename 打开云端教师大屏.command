#!/bin/zsh
lesson_root=${0:A:h}
lesson_entry="$lesson_root/.private/教师专用入口.txt"
if [[ ! -f "$lesson_entry" ]]; then
  print '教师专用入口文件缺失，请从本项目的私有备份恢复。'
  read 'reply?按回车退出'
  exit 1
fi
IFS= read -r lesson_url < "$lesson_entry"
open "$lesson_url"
