#!/bin/bash

# Скрипт для подключения к GitHub после создания репозитория

echo "Настройка git remote..."

# Замените YOUR_USERNAME на ваш GitHub username
git remote add origin https://github.com/YOUR_USERNAME/mcp-lite-github-app.git

# Или если используете SSH:
# git remote add origin git@github.com:YOUR_USERNAME/mcp-lite-github-app.git

git branch -M main
git push -u origin main

echo "Готово! Репозиторий подключен."