# Optional WebSocket example

This example belongs to the former hosting environment, not the EAInesy v2 application runtime.
It requires `socket.io` and `socket.io-client`, which are not declared in the application lockfile.
It is excluded from the application TypeScript project; it has not been verified as independently deployable.
To use it, configure a separate example project with those dependencies and adapt its `XTransformPort` routing.
