# Nexys A7 Logic Analyzer

This project is a logic analyzer for the Digilent Nexys A7-100T FPGA board.

## Current Status

- [x] VHDL project setup
- [x] LED blink test
- [ ] UART transmitter
- [ ] UART receiver
- [ ] Capture buffer
- [ ] Trigger logic
- [ ] C# serial monitor
- [ ] C# waveform viewer

## Board

Target board:

- Digilent Nexys A7-100T
- FPGA: Xilinx Artix-7 XC7A100T-1CSG324C
- Clock: 100 MHz

## Creating the Vivado Project

From the repository root:

```bash
vivado -mode batch -source scripts/create_project.tcl
