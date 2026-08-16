module top (
    input  logic        CLK100MHZ,
    input  logic        BTNC,

    output logic [15:0] LED,

    input  logic        UART_RXD,
    output logic        UART_TXD
);

    // ----------------------------------------------------------------
    // Constants
    // ----------------------------------------------------------------
    localparam int ClksPerBit = 868;
    localparam int AckLen     = 5;

    localparam logic [7:0] AckMessage [AckLen] = '{
        8'h41,  // A
        8'h43,  // C
        8'h4B,  // K
        8'h0D,  // carriage return
        8'h0A   // newline
    };

    // ----------------------------------------------------------------
    // Reset
    // ----------------------------------------------------------------
    logic rst_n;

    assign rst_n = ~BTNC;

    // ----------------------------------------------------------------
    // Heartbeat
    // ----------------------------------------------------------------
    logic [26:0] heartbeat_counter;

    // ----------------------------------------------------------------
    // UART TX signals
    // ----------------------------------------------------------------
    logic       tx_start;
    logic [7:0] tx_data;
    logic       tx_serial;
    logic       tx_busy;
    logic       tx_done;

    // ----------------------------------------------------------------
    // UART RX signals
    // ----------------------------------------------------------------
    logic [7:0] rx_data;
    logic       rx_valid;
    logic       rx_frame_error;

    logic [7:0] rx_led_value;

    // ----------------------------------------------------------------
    // ACK transmitter state machine
    // ----------------------------------------------------------------
    typedef enum logic [1:0] {
        TxIdle,
        TxSendByte,
        TxWaitDone
    } tx_state_t;

    tx_state_t tx_state;

    logic [$clog2(AckLen)-1:0] ack_index;
    logic                       ack_pending;

    // ----------------------------------------------------------------
    // UART output
    // ----------------------------------------------------------------
    assign UART_TXD = tx_serial;

    // ----------------------------------------------------------------
    // UART transmitter
    // ----------------------------------------------------------------
    uart_tx #(
        .ClksPerBit(ClksPerBit)
    ) uart_tx_inst (
        .clk       (CLK100MHZ),
        .rst_n     (rst_n),
        .tx_start  (tx_start),
        .tx_data   (tx_data),
        .tx_serial (tx_serial),
        .tx_busy   (tx_busy),
        .tx_done   (tx_done)
    );

    // ----------------------------------------------------------------
    // UART receiver
    // ----------------------------------------------------------------
    uart_rx #(
        .ClksPerBit(ClksPerBit)
    ) uart_rx_inst (
        .clk         (CLK100MHZ),
        .rst_n       (rst_n),
        .rx_serial   (UART_RXD),
        .rx_data     (rx_data),
        .rx_valid    (rx_valid),
        .frame_error (rx_frame_error)
    );

    // ----------------------------------------------------------------
    // Main logic
    // ----------------------------------------------------------------
    always_ff @(posedge CLK100MHZ or negedge rst_n) begin
        if (!rst_n) begin
            heartbeat_counter <= '0;

            tx_start   <= 1'b0;
            tx_data    <= 8'h00;
            tx_state   <= TxIdle;
            ack_index  <= '0;
            ack_pending <= 1'b0;

            rx_led_value <= 8'h00;

        end else begin
            // --------------------------------------------------------
            // Heartbeat counter
            // --------------------------------------------------------
            heartbeat_counter <= heartbeat_counter + 1'b1;

            // tx_start is a one-clock pulse.
            tx_start <= 1'b0;

            // --------------------------------------------------------
            // Receive UART byte
            // --------------------------------------------------------
            if (rx_valid) begin
                rx_led_value <= rx_data;
                ack_pending  <= 1'b1;
            end

            // --------------------------------------------------------
            // ACK transmit state machine
            // --------------------------------------------------------
            case (tx_state)

                TxIdle: begin
                    if (ack_pending && !tx_busy) begin
                        ack_pending <= 1'b0;
                        ack_index   <= '0;
                        tx_state    <= TxSendByte;
                    end
                end

                TxSendByte: begin
                    if (!tx_busy) begin
                        tx_data  <= AckMessage[ack_index];
                        tx_start <= 1'b1;
                        tx_state <= TxWaitDone;
                    end
                end

                TxWaitDone: begin
                    if (tx_done) begin
                        if (ack_index < AckLen - 1) begin
                            ack_index <= ack_index + 1'b1;
                            tx_state  <= TxSendByte;
                        end else begin
                            ack_index <= '0;
                            tx_state  <= TxIdle;
                        end
                    end
                end

                default: begin
                    tx_state <= TxIdle;
                end

            endcase
        end
    end

    // ----------------------------------------------------------------
    // LEDs
    // ----------------------------------------------------------------

    // Binary value of most recently received byte.
    assign LED[7:0] = rx_led_value;

    // Status LEDs.
    assign LED[8]  = heartbeat_counter[26];
    assign LED[9]  = tx_busy;
    assign LED[10] = rx_valid;
    assign LED[11] = rx_frame_error;
    assign LED[12] = ~tx_serial;
    assign LED[13] = ~rst_n;

    assign LED[15:14] = 2'b00;

endmodule
