module uart_rx #(
    parameter int ClksPerBit = 868
) (
    input  logic       clk,
    input  logic       rst_n,

    input  logic       rx_serial,

    output logic [7:0] rx_data,
    output logic       rx_valid,
    output logic       frame_error
);

    // ----------------------------------------------------------------
    // UART receiver state machine
    // ----------------------------------------------------------------
    typedef enum logic [1:0] {
        Idle,
        StartBit,
        DataBits,
        StopBit
    } rx_state_t;

    rx_state_t state;

    // ----------------------------------------------------------------
    // Receive timing
    // ----------------------------------------------------------------
    int unsigned clk_cnt;
    int unsigned bit_idx;

    logic [7:0] rx_shift;

    // ----------------------------------------------------------------
    // UART RX input synchronizer
    //
    // rx_serial is asynchronous relative to clk, so pass it through
    // two flip-flops before using it in the UART state machine.
    // ----------------------------------------------------------------
    logic rx_sync_1;
    logic rx_sync_2;

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rx_sync_1 <= 1'b1;
            rx_sync_2 <= 1'b1;
        end else begin
            rx_sync_1 <= rx_serial;
            rx_sync_2 <= rx_sync_1;
        end
    end

    // ----------------------------------------------------------------
    // UART receiver
    // ----------------------------------------------------------------
    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= Idle;

            clk_cnt <= 0;
            bit_idx <= 0;

            rx_shift <= 8'h00;

            rx_data     <= 8'h00;
            rx_valid    <= 1'b0;
            frame_error <= 1'b0;

        end else begin
            // rx_valid and frame_error are one-clock pulses.
            rx_valid    <= 1'b0;
            frame_error <= 1'b0;

            case (state)

                // ----------------------------------------------------
                // Wait for the UART line to transition low,
                // indicating the beginning of a start bit.
                // ----------------------------------------------------
                Idle: begin
                    clk_cnt <= 0;
                    bit_idx <= 0;

                    if (!rx_sync_2) begin
                        state <= StartBit;
                    end
                end

                // ----------------------------------------------------
                // Sample the start bit approximately halfway through
                // its period to verify that it is a valid start bit.
                // ----------------------------------------------------
                StartBit: begin
                    if (clk_cnt == (ClksPerBit / 2)) begin
                        clk_cnt <= 0;

                        if (!rx_sync_2) begin
                            state <= DataBits;
                        end else begin
                            state <= Idle;
                        end
                    end else begin
                        clk_cnt <= clk_cnt + 1;
                    end
                end

                // ----------------------------------------------------
                // Receive eight data bits, least-significant bit first.
                // ----------------------------------------------------
                DataBits: begin
                    if (clk_cnt == ClksPerBit - 1) begin
                        clk_cnt <= 0;

                        rx_shift[bit_idx] <= rx_sync_2;

                        if (bit_idx == 7) begin
                            bit_idx <= 0;
                            state   <= StopBit;
                        end else begin
                            bit_idx <= bit_idx + 1;
                        end
                    end else begin
                        clk_cnt <= clk_cnt + 1;
                    end
                end

                // ----------------------------------------------------
                // Verify that the stop bit is high.
                //
                // A valid stop bit produces rx_valid for one clock.
                // An invalid stop bit produces frame_error instead.
                // ----------------------------------------------------
                StopBit: begin
                    if (clk_cnt == ClksPerBit - 1) begin
                        clk_cnt <= 0;

                        if (rx_sync_2) begin
                            rx_data  <= rx_shift;
                            rx_valid <= 1'b1;
                        end else begin
                            frame_error <= 1'b1;
                        end

                        state <= Idle;
                    end else begin
                        clk_cnt <= clk_cnt + 1;
                    end
                end

                default: begin
                    state   <= Idle;
                    clk_cnt <= 0;
                    bit_idx <= 0;
                end

            endcase
        end
    end

endmodule
