# SecretInference Releases

Each release records the image digest pinned in docker-compose.yaml.
RTMR3 in the TDX attestation quote is a hash of docker-compose.yaml —
compare against this table to verify what code is running.

## How to verify

1. Call GET /attest on a running instance
2. Note the rtmr3 value
3. Check the docker-compose.yaml for that release tag
4. The sha256 of the docker-compose.yaml contents should produce
   a value that matches what SecretVM measured into RTMR3

## Version history

| Version | Date | Image digest (sha256) | Notes |
|---|---|---|---|
| v1.0.0 | TBD | TBD | Initial release |
