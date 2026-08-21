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
    typedef enum logic [1:0] {
        Idle,
        StartBit,
        DataBits,
        StopBit
    } rx_state_t;

    rx_state_t state;

    int unsigned clk_cnt;
    int unsigned bit_idx;
    logic [7:0] rx_shift;

    logic rx_sync_1;
    logic rx_sync_2;

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rx_sync_1 <= 1'b1;
            rx_sync_2 <= 1'b1;
        end
        else begin
            rx_sync_1 <= rx_serial;
            rx_sync_2 <= rx_sync_1;
        end
    end

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= Idle;

            clk_cnt <= 0;
            bit_idx <= 0;

            rx_shift <= 8'h00;

            rx_data     <= 8'h00;
            rx_valid    <= 1'b0;
            frame_error <= 1'b0;

        end
        else begin
            rx_valid    <= 1'b0;
            frame_error <= 1'b0;

            case (state)
                Idle: begin
                    clk_cnt <= 0;
                    bit_idx <= 0;

                    if (!rx_sync_2) state <= StartBit;
                end

                StartBit: begin
                    if (clk_cnt == (ClksPerBit / 2)) begin
                        clk_cnt <= 0;

                        if (!rx_sync_2) state <= DataBits;
                        else state <= Idle;

                    end
                    else clk_cnt <= clk_cnt + 1;
                end

                DataBits: begin
                    if (clk_cnt == ClksPerBit - 1) begin
                        clk_cnt <= 0;

                        rx_shift[bit_idx] <= rx_sync_2;

                        if (bit_idx == 7) begin
                            bit_idx <= 0;
                            state   <= StopBit;
                        end
                        else bit_idx <= bit_idx + 1;

                    end
                    else clk_cnt <= clk_cnt + 1;
                end

                StopBit: begin
                    if (clk_cnt == ClksPerBit - 1) begin
                        clk_cnt <= 0;

                        if (rx_sync_2) begin
                            rx_data  <= rx_shift;
                            rx_valid <= 1'b1;
                        end
                        else frame_error <= 1'b1;

                        state <= Idle;
                    end
                    else clk_cnt <= clk_cnt + 1;
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
