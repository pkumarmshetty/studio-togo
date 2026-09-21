# ---------------------
# Build stage
# ---------------------
FROM node:22-alpine AS build

# Enable corepack and install a specific pnpm version securely
RUN corepack enable && corepack prepare pnpm@10.3.0 --activate


# Set working directory
WORKDIR /app

# Copy only necessary files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
# sonarcloud: disable=ShellScriptExecutionRisk
RUN pnpm install

# Copy the rest of the source code
COPY . .
# COPY .next ./.next
# COPY public ./public
# COPY node_modules ./node_modules

# Next.js inlines NEXT_PUBLIC_* at build time - must arrive as build args, not just runtime env
ARG NEXT_PUBLIC_MODE
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_ECOSYSTEM_FRONT_END_URL
ARG NEXT_PUBLIC_PLATFORM_NAME
ARG NEXT_PUBLIC_POLYGON_TESTNET_URL
ARG NEXT_PUBLIC_POLYGON_MAINNET_URL
ARG NEXT_PUBLIC_ENABLE_APP_LAUNCHER
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN
ARG NEXT_PUBLIC_ENABLE_BILLING_OPTION
ARG NEXT_PUBLIC_ACTIVE_THEME
ARG NEXT_PUBLIC_APP_TITLE
ARG NEXT_PUBLIC_FOOTER_TEXT
ARG NEXT_PUBLIC_LOGO_BASE_URL
ARG NEXT_PUBLIC_ADMIN_PORTAL_CLIENT_ID
ARG NEXT_PUBLIC_LANDINGPAGE_URL
ARG NEXT_PUBLIC_CURRENT_RELEASE
ENV NEXT_PUBLIC_MODE=$NEXT_PUBLIC_MODE \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_ECOSYSTEM_FRONT_END_URL=$NEXT_PUBLIC_ECOSYSTEM_FRONT_END_URL \
    NEXT_PUBLIC_PLATFORM_NAME=$NEXT_PUBLIC_PLATFORM_NAME \
    NEXT_PUBLIC_POLYGON_TESTNET_URL=$NEXT_PUBLIC_POLYGON_TESTNET_URL \
    NEXT_PUBLIC_POLYGON_MAINNET_URL=$NEXT_PUBLIC_POLYGON_MAINNET_URL \
    NEXT_PUBLIC_ENABLE_APP_LAUNCHER=$NEXT_PUBLIC_ENABLE_APP_LAUNCHER \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN=$NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN \
    NEXT_PUBLIC_ENABLE_BILLING_OPTION=$NEXT_PUBLIC_ENABLE_BILLING_OPTION \
    NEXT_PUBLIC_ACTIVE_THEME=$NEXT_PUBLIC_ACTIVE_THEME \
    NEXT_PUBLIC_APP_TITLE=$NEXT_PUBLIC_APP_TITLE \
    NEXT_PUBLIC_FOOTER_TEXT=$NEXT_PUBLIC_FOOTER_TEXT \
    NEXT_PUBLIC_LOGO_BASE_URL=$NEXT_PUBLIC_LOGO_BASE_URL \
    NEXT_PUBLIC_ADMIN_PORTAL_CLIENT_ID=$NEXT_PUBLIC_ADMIN_PORTAL_CLIENT_ID \
    NEXT_PUBLIC_LANDINGPAGE_URL=$NEXT_PUBLIC_LANDINGPAGE_URL \
    NEXT_PUBLIC_CURRENT_RELEASE=$NEXT_PUBLIC_CURRENT_RELEASE

# Build the Next.js application
RUN pnpm run build

# ---------------------
# Production stage
# ---------------------
FROM node:22-alpine AS production

# Create a non-root user
# RUN groupadd -r appgroup && useradd -r -g appgroup appuser
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Set working directory
WORKDIR /app

# Copy necessary build artifacts from build stage
COPY --from=build /app/package.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Start the Next.js application
CMD ["npm", "start"]
