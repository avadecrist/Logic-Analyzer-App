# Commands

Packet `TYPE` values, sent inside the frame described in `packet.md`.
Request/response pairs are correlated by the packet `ID` field, not by `TYPE`.
The host picks an `ID` per outstanding request and the board
echoes it back on the matching response.

| Type | Name      | Direction     | Payload                            |
| ---- | --------- | ------------- | ---------------------------------  |
| 0x01 | PING      | Host -> Board | none                               |
| 0x02 | PONG      | Board -> Host | `[major, minor]` firmware version  |
| 0x03 | START     | Host -> Board | none                               |
| 0x04 | START_ACK | Board -> Host | none                               |
| 0x05 | STOP      | Host -> Board | none                               |
| 0x06 | STOP_ACK  | Board -> Host | none                               |
| 0x07 | SAMPLES   | Board -> Host | `elapsedMs` (uint32 LE, ms since   |
START) + 1 byte channel bitmask (bit *i* = channel *i* level)           |

`SAMPLES` isn't a reply to anything, so it's sent with
`ID` 0. The host never allocates 0 for its own requests, so it won't collide with a pending request/response pair. 
The board sends one `SAMPLES` packet per sample tick for as long as acquisition is running, until `STOP` is received.
