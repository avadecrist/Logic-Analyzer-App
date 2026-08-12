module uart_tx #(
    parameter int ClksPerBit = 868
) (
    input  logic       clk,
    input  logic       rst_n,

    input  logic       tx_start,
    input  logic [7:0] tx_data,

    output logic       tx_serial,
    output logic       tx_busy,
    output logic       tx_done
);

    // ----------------------------------------------------------------
    // UART transmitter state machine
    // ----------------------------------------------------------------
    typedef enum logic [1:0] {
        Idle,
        StartBit,
        DataBits,
        StopBit
    } tx_state_t;

    tx_state_t state;

    // ----------------------------------------------------------------
    // Transmit timing and data
    // ----------------------------------------------------------------
    int unsigned clk_cnt;
    int unsigned bit_idx;

    logic [7:0] tx_data_reg;

    // ----------------------------------------------------------------
    // UART transmitter
    // ----------------------------------------------------------------
    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= Idle;

            clk_cnt <= 0;
            bit_idx <= 0;

            tx_data_reg <= 8'h00;

            tx_serial <= 1'b0;
            tx_busy   <= 1'b0;
            tx_done   <= 1'b0;

        end else begin
            // tx_done is asserted for only one clock cycle.
            tx_done <= 1'b0;

            case (state)

                // ----------------------------------------------------
                // UART line is high while idle.
                //
                // When tx_start is asserted, latch the byte and begin
                // transmitting.
                // ----------------------------------------------------
                Idle: begin
                    tx_serial <= 1'b1;
                    tx_busy   <= 1'b0;

                    clk_cnt <= 0;
                    bit_idx <= 0;

                    if (tx_start) begin
                        tx_data_reg <= tx_data;
                        tx_busy     <= 1'b1;
                        state       <= StartBit;
                    end
                end

                // ----------------------------------------------------
                // Send the start bit.
                //
                // UART start bits are logic low.
                // ----------------------------------------------------
                StartBit: begin
                    tx_serial <= 1'b0;
                    tx_busy   <= 1'b1;

                    if (clk_cnt < ClksPerBit - 1) begin
                        clk_cnt <= clk_cnt + 1;
                    end else begin
                        clk_cnt <= 0;
                        state   <= DataBits;
                    end
                end

                // ----------------------------------------------------
                // Send eight data bits, least-significant bit first.
                // ----------------------------------------------------
                DataBits: begin
                    tx_serial <= tx_data_reg[bit_idx];
                    tx_busy   <= 1'b1;

                    if (clk_cnt < ClksPerBit - 1) begin
                        clk_cnt <= clk_cnt + 1;
                    end else begin
                        clk_cnt <= 0;

                        if (bit_idx < 7) begin
                            bit_idx <= bit_idx + 1;
                        end else begin
                            bit_idx <= 0;
                            state   <= StopBit;
                        end
                    end
                end

                // ----------------------------------------------------
                // Send the stop bit.
                //
                // UART stop bits are logic high.
                // ----------------------------------------------------
                StopBit: begin
                    tx_serial <= 1'b1;
                    tx_busy   <= 1'b1;

                    if (clk_cnt < ClksPerBit - 1) begin
                        clk_cnt <= clk_cnt + 1;
                    end else begin
                        clk_cnt <= 0;

                        tx_busy <= 1'b1;
                        tx_done <= 1'b1;

                        state <= Idle;
                    end
                end

                default: begin
                    state <= Idle;

                    clk_cnt <= 0;
                    bit_idx <= 0;

                    tx_serial <= 1'b1;
                    tx_busy   <= 1'b0;
                    tx_done   <= 1'b0;
                end

            endcase
        end
    end

endmodule
