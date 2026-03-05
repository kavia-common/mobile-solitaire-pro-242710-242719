#!/bin/bash
cd /home/kavia/workspace/code-generation/mobile-solitaire-pro-242710-242719/solitaire_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

