# Stage 1: Build
FROM public.ecr.aws/docker/library/node:18 AS builder
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . ./

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

ENV NEXT_PUBLIC_AZURE_AD_TENANT_ID=$NEXT_PUBLIC_AZURE_AD_TENANT_ID
ENV NEXT_PUBLIC_AZURE_AD_CLIENT_ID=$NEXT_PUBLIC_AZURE_AD_CLIENT_ID
ENV NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=$NEXT_PUBLIC_AZURE_AD_REDIRECT_URI
ENV NEXT_PUBLIC_AZURE_AD_SCOPES=$NEXT_PUBLIC_AZURE_AD_SCOPES
ENV NEXT_PUBLIC_ENABLE_MONGODB_LOGIN=$NEXT_PUBLIC_ENABLE_MONGODB_LOGIN
ENV NEXT_PUBLIC_ENABLE_LOCAL_LOGIN=$NEXT_PUBLIC_ENABLE_LOCAL_LOGIN
ENV NEXT_PUBLIC_REDIS_HOST=$NEXT_PUBLIC_REDIS_HOST
ENV NEXT_PUBLIC_REDIS_PORT=$NEXT_PUBLIC_REDIS_PORT
ENV NEXT_PUBLIC_REDIS_DATABASE=$NEXT_PUBLIC_REDIS_DATABASE

RUN npm run build

# Stage 2: Run
FROM public.ecr.aws/docker/library/node:18-alpine

RUN apk update && apk upgrade

RUN addgroup -g 1001 -S appuser \
    && adduser -h /home/appuser appuser -u 1001 -G appuser --disabled-password

RUN mkdir -p /app && chown -R appuser:appuser /app

WORKDIR /app

# Copy standalone output from builder
COPY --from=builder --chown=appuser:appuser /usr/src/app/.next/standalone ./
COPY --from=builder --chown=appuser:appuser /usr/src/app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appuser /usr/src/app/public ./public

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# MONGODB_* and other secrets are injected at runtime on the EC2 instance
CMD ["node", "server.js"]
