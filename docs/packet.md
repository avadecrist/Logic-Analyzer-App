# UART Packet

## Packet Breakdown
```
SYNC | VERSION | TYPE | ID | LENGTH | PAYLOAD | CRC
```

| Byte | Description | Size |
| -------- | -------- | -------- |
| Sync   | Fixed bytes that mark the start of a packet, e.g. `0xA5 0x5A`.   | 2 Bytes |
| Version   | Identifies the protocol version so the host and FPGA know how to interpret the packet.   | 1 Byte |
| ID   | Identifies the request/transaction so a response can be matched to the correct request.   | 2 Bytes |
| Length   | Specifies number of bytes contained in the payload.   | 2 Bytes |
| Payload   | The actual command, response, configuration, or captured data being transferred.   | N Bytes (Specified by Length) |
| CRC   | CRC-16/CCITT-FALSE checksum over the packet contents using polynomial `0x1021` and initial value `0xFFFF`.  | 2 Bytes |

## Bytes:
Example payload
```
Byte
 0        0xA5                 Sync byte 0
 1        0x5A                 Sync byte 1
 2        Version              currently 0x01
 3        Type                 command/response
 4        ID LSB
 5        ID MSB
 6        Length LSB
 7        Length MSB
 8...     Payload
 N,N+1    CRC16 LSB/MSB
```