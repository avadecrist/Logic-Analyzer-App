# Commands

Packet `TYPE` values, sent inside the frame described in `packet.md`.
Request/response pairs are correlated by the packet `ID` field, not by
`TYPE` — the host picks an `ID` per outstanding request and the board
echoes it back on the matching response.

| Type | Name | Direction     | Payload                          |
| ---- | ---- | ------------- | --------------------------------- |
| 0x01 | PING | Host -> Board | none                               |
| 0x02 | PONG | Board -> Host | `[major, minor]` firmware version |
