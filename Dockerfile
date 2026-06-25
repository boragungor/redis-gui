# --- Base stage ---
FROM public.ecr.aws/docker/library/node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies stage ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build stage ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the bundle at build time
ARG NEXT_PUBLIC_AZURE_AD_TENANT_ID
ARG NEXT_PUBLIC_AZURE_AD_CLIENT_ID
ARG NEXT_PUBLIC_AZURE_AD_REDIRECT_URI
ARG NEXT_PUBLIC_AZURE_AD_SCOPES
ARG NEXT_PUBLIC_ENABLE_MONGODB_LOGIN
ARG NEXT_PUBLIC_ENABLE_LOCAL_LOGIN
ARG NEXT_PUBLIC_REDIS_HOST
ARG NEXT_PUBLIC_REDIS_PORT
ARG NEXT_PUBLIC_REDIS_DATABASE
ARG NEXT_PUBLIC_BASE_PATH

ENV NEXT_PUBLIC_AZURE_AD_TENANT_ID=$NEXT_PUBLIC_AZURE_AD_TENANT_ID
ENV NEXT_PUBLIC_AZURE_AD_CLIENT_ID=$NEXT_PUBLIC_AZURE_AD_CLIENT_ID
ENV NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=$NEXT_PUBLIC_AZURE_AD_REDIRECT_URI
ENV NEXT_PUBLIC_AZURE_AD_SCOPES=$NEXT_PUBLIC_AZURE_AD_SCOPES
ENV NEXT_PUBLIC_ENABLE_MONGODB_LOGIN=$NEXT_PUBLIC_ENABLE_MONGODB_LOGIN
ENV NEXT_PUBLIC_ENABLE_LOCAL_LOGIN=$NEXT_PUBLIC_ENABLE_LOCAL_LOGIN
ENV NEXT_PUBLIC_REDIS_HOST=$NEXT_PUBLIC_REDIS_HOST
ENV NEXT_PUBLIC_REDIS_PORT=$NEXT_PUBLIC_REDIS_PORT
ENV NEXT_PUBLIC_REDIS_DATABASE=$NEXT_PUBLIC_REDIS_DATABASE
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

RUN pnpm build

# --- Production stage ---
FROM public.ecr.aws/docker/library/node:22-alpine AS runner

RUN apk update && apk upgrade

RUN addgroup -g 1001 -S appuser \
    && adduser -h /home/appuser appuser -u 1001 -G appuser --disabled-password

WORKDIR /app

COPY --from=builder --chown=appuser:appuser /app/public ./public
COPY --from=builder --chown=appuser:appuser /app/.next/standalone ./
COPY --from=builder --chown=appuser:appuser /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# MONGODB_* and other secrets are injected at runtime on the EC2 instance
CMD ["node", "server.js"]
