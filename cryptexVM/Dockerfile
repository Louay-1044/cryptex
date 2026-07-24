FROM alpine:latest AS builder

ARG ZIG_VERSION=0.15.2
ARG TARGETARCH

# Map Docker architecture names to Zig's naming convention
RUN if [ "$TARGETARCH" = "amd64" ]; then \
      ZIG_ARCH="x86_64"; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
      ZIG_ARCH="aarch64"; \
    else \
      echo "Unsupported architecture: $TARGETARCH"; exit 1; \
    fi && \
    ZIG_FILE=zig-${ZIG_ARCH}-linux-${ZIG_VERSION} && \
    ZIG_URL=https://ziglang.org/download/${ZIG_VERSION}/${ZIG_FILE}.tar.xz && \
    apk add --no-cache curl xz && \
    curl -L ${ZIG_URL} | \
    tar -xJ -C /usr/local && \
    ln -s /usr/local/${ZIG_FILE}/zig /usr/local/bin/zig

WORKDIR /app

# Copy source files
COPY build.zig build.zig.zon* ./
COPY src/ src/

RUN zig build -Doptimize=ReleaseFast

FROM alpine:latest
WORKDIR /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /app/shared

# COPY binary from builder stage
COPY --from=builder /app/zig-out/ /app/zig-out/

VOLUME /app/shared

ENTRYPOINT ["/entrypoint.sh"]
