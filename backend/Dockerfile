FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install --require-hashes --retries 10 --timeout 60 -r requirements.txt
COPY main.py .
# Files stay root-owned and read-only to the app user.
USER 10001:10001
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
