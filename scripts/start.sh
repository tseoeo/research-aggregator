#!/bin/bash
set -e

echo "Running database migrations..."
npm run db:push

echo "Starting application..."
exec npm run start
