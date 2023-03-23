FROM debian:stable
LABEL maintainer="aureq@pulumi.com"
LABEL version="1.1"

COPY entrypoint.sh /entrypoint.sh

RUN chown root:root /entrypoint.sh && \
    chmod 0755 /entrypoint.sh

ENTRYPOINT [ "/bin/bash", "/entrypoint.sh" ]