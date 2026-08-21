module packet_tx #(
    parameter logic [7:0] ProtocolVersion = 8'h01
) (
    input logic clk,
    input logic rst_n,

    input logic        packet_start,
    input logic [7:0]  packet_type,
    input logic [15:0] packet_id,
    input logic [15:0] payload_length,

    output logic packet_ready,
    output logic packet_busy,
    output logic packet_done,

    input  logic [7:0] payload_data,
    input  logic       payload_valid,
    output logic       payload_ready,

    output logic       tx_start,
    output logic [7:0] tx_data,

    input logic tx_busy,
    input logic tx_done
);
    localparam logic [7:0] Sync0 = 8'hA5;
    localparam logic [7:0] Sync1 = 8'h5A;

    typedef enum logic [3:0] {
        Idle,
        SendSync0,
        SendSync1,
        SendVersion,
        SendType,
        SendId0,
        SendId1,
        SendLength0,
        SendLength1,
        SendPayload,
        SendCrc0,
        SendCrc1
    } packet_tx_state_t;

    packet_tx_state_t state;

    logic [7:0]  type_reg;
    logic [15:0] id_reg;
    logic [15:0] length_reg;

    logic [15:0] payload_index;

    logic byte_in_flight;

    logic [15:0] crc;

    function automatic logic [15:0] crc16_update(
        input logic [15:0] current_crc,
        input logic [7:0]  data
    );
        logic [15:0] next_crc;
        integer bit_index;

        begin
            next_crc = current_crc ^ ({8'h00, data} << 8);

            for (bit_index = 0; bit_index < 8; bit_index++) begin
                if (next_crc[15]) next_crc = (next_crc << 1) ^ 16'h1021;
                else next_crc = next_crc << 1;
            end

            return next_crc;
        end
    endfunction

    always_comb begin
        packet_ready = (state == Idle) && !byte_in_flight;
        packet_busy  = (state != Idle);
        payload_ready = (state == SendPayload) &&
                        !byte_in_flight &&
                        !tx_busy;
    end

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= Idle;

            type_reg     <= 8'h00;
            id_reg       <= 16'h0000;
            length_reg   <= 16'h0000;

            payload_index <= 16'h0000;

            crc <= 16'hFFFF;

            byte_in_flight <= 1'b0;

            tx_start <= 1'b0;
            tx_data  <= 8'h00;

            packet_done <= 1'b0;

        end
        else begin
            tx_start    <= 1'b0;
            packet_done <= 1'b0;

            if (byte_in_flight && tx_done) begin
                byte_in_flight <= 1'b0;

                case (state)
                    SendSync0:     state <= SendSync1;
                    SendSync1:     state <= SendVersion;
                    SendVersion:   state <= SendType;
                    SendType:      state <= SendId0;
                    SendId0: state <= SendId1;
                    SendId1: state <= SendLength0;
                    SendLength0:   state <= SendLength1;

                    SendLength1: begin
                        if (length_reg == 0) state <= SendCrc0;
                        else state <= SendPayload;
                    end

                    SendPayload: begin
                        if (payload_index == length_reg) state <= SendCrc0;
                    end

                    SendCrc0: state <= SendCrc1;

                    SendCrc1: begin
                        packet_done <= 1'b1;
                        state       <= Idle;
                    end

                    default: state <= Idle;
                endcase
            end

            if (state == Idle) begin
                if (packet_start) begin
                    type_reg      <= packet_type;
                    id_reg        <= packet_id;
                    length_reg    <= payload_length;
                    payload_index <= 16'h0000;
                    crc           <= 16'hFFFF;
                    state         <= SendSync0;
                end
            end
            else if (state == SendSync0 && !byte_in_flight && !tx_busy) begin
                tx_data        <= Sync0;
                tx_start       <= 1'b1;
                byte_in_flight <= 1'b1;
            end
            else if (state == SendSync1 && !byte_in_flight && !tx_busy) begin
                tx_data        <= Sync1;
                tx_start       <= 1'b1;
                byte_in_flight <= 1'b1;

            end
            else if (state == SendVersion && !byte_in_flight && !tx_busy) begin
                tx_data        <= ProtocolVersion;
                tx_start       <= 1'b1;
                crc            <= crc16_update(crc, ProtocolVersion);
                byte_in_flight <= 1'b1;
            end
            else if (state == SendType && !byte_in_flight && !tx_busy) begin
                tx_data        <= type_reg;
                tx_start       <= 1'b1;
                crc            <= crc16_update(crc, type_reg);
                byte_in_flight <= 1'b1;
            end
            else if (state == SendId0 && !byte_in_flight && !tx_busy) begin
                tx_data        <= id_reg[7:0];
                tx_start       <= 1'b1;
                crc            <= crc16_update(crc, id_reg[7:0]);
                byte_in_flight <= 1'b1;
            end
            else if (state == SendId1 && !byte_in_flight &&!tx_busy) begin
                tx_data        <= id_reg[15:8];
                tx_start       <= 1'b1;
                crc            <= crc16_update(crc, id_reg[15:8]);
                byte_in_flight <= 1'b1;
            end
            else if (state == SendLength0 && !byte_in_flight && !tx_busy) begin
                tx_data        <= length_reg[7:0];
                tx_start       <= 1'b1;
                crc            <= crc16_update(crc, length_reg[7:0]);
                byte_in_flight <= 1'b1;
            end
            else if (state == SendLength1 && !byte_in_flight && !tx_busy) begin
                tx_data        <= length_reg[15:8];
                tx_start       <= 1'b1;
                crc            <= crc16_update(crc, length_reg[15:8]);
                byte_in_flight <= 1'b1;
            end
            else if (state == SendPayload && !byte_in_flight && !tx_busy && payload_valid) begin
                tx_data        <= payload_data;
                tx_start       <= 1'b1;
                crc            <= crc16_update(crc, payload_data);
                payload_index  <= payload_index + 1'b1;
                byte_in_flight <= 1'b1;
            end
            else if (state == SendCrc0 && !byte_in_flight && !tx_busy) begin
                tx_data        <= crc[7:0];
                tx_start       <= 1'b1;
                byte_in_flight <= 1'b1;
            end
            else if (state == SendCrc1 && !byte_in_flight && !tx_busy) begin
                tx_data        <= crc[15:8];
                tx_start       <= 1'b1;
                byte_in_flight <= 1'b1;
            end
        end
    end

endmodule
