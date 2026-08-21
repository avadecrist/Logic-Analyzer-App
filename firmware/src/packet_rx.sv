module packet_rx #(
    parameter int MaxPayloadBytes = 256
) (
    input logic clk,
    input logic rst_n,
    input logic [7:0] rx_data,
    input logic       rx_valid,

    output logic        packet_valid,
    output logic        packet_error,
    output logic [7:0]  packet_type,
    output logic [15:0] packet_id,
    output logic [15:0] payload_length,

    output logic [7:0] payload_data [MaxPayloadBytes],

    output logic crc_error,
    output logic length_error
);
    localparam logic [7:0] Sync0           = 8'hA5;
    localparam logic [7:0] Sync1           = 8'h5A;
    localparam logic [7:0] ProtocolVersion = 8'h01;

    typedef enum logic [3:0] {
        WaitSync0,
        WaitSync1,
        ReadVersion,
        ReadType,
        ReadId0,
        ReadId1,
        ReadLength0,
        ReadLength1,
        ReadPayload,
        ReadCrc0,
        ReadCrc1
    } packet_rx_state_t;

    packet_rx_state_t state;

    logic [7:0] version;
    logic [7:0] id_lsb;
    logic [7:0] length_lsb;
    logic [7:0] received_crc_lsb;

    logic [15:0] payload_index;

    logic [15:0] crc;

    // ----------------------------------------------------------------
    // CRC-16/CCITT-FALSE
    //
    // Polynomial: 0x1021
    // Initial:    0xFFFF
    // ----------------------------------------------------------------
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

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= WaitSync0;

            version         <= 8'h00;
            packet_type     <= 8'h00;
            packet_id       <= 16'h0000;
            payload_length  <= 16'h0000;

            id_lsb           <= 8'h00;
            length_lsb       <= 8'h00;
            received_crc_lsb <= 8'h00;

            payload_index <= 16'h0000;

            crc <= 16'hFFFF;

            packet_valid <= 1'b0;
            packet_error <= 1'b0;

            crc_error    <= 1'b0;
            length_error <= 1'b0;

        end
        else begin
            packet_valid <= 1'b0;
            packet_error <= 1'b0;
            crc_error    <= 1'b0;
            length_error <= 1'b0;

            if (rx_valid) begin
                case (state)

                    WaitSync0: if (rx_data == Sync0) state <= WaitSync1;

                    WaitSync1: begin
                        if (rx_data == Sync1) state <= ReadVersion;
                        else if (rx_data == Sync0) state <= WaitSync1;
                        else state <= WaitSync0;
                    end

                    ReadVersion: begin
                        version <= rx_data;
                        crc     <= crc16_update(16'hFFFF, rx_data);

                        if (rx_data == ProtocolVersion) state <= ReadType;
                        else begin
                            packet_error <= 1'b1;
                            state        <= WaitSync0;
                        end
                    end

                    ReadType: begin
                        packet_type <= rx_data;
                        crc         <= crc16_update(crc, rx_data);
                        state       <= ReadId0;
                    end

                    ReadId0: begin
                        id_lsb <= rx_data;
                        crc          <= crc16_update(crc, rx_data);
                        state        <= ReadId1;
                    end

                    ReadId1: begin
                        packet_id <= {rx_data, id_lsb};
                        crc             <= crc16_update(crc, rx_data);
                        state           <= ReadLength0;
                    end

                    ReadLength0: begin
                        length_lsb <= rx_data;
                        crc        <= crc16_update(crc, rx_data);
                        state      <= ReadLength1;
                    end

                    ReadLength1: begin
                        payload_length <= {rx_data, length_lsb};
                        payload_index  <= 16'h0000;
                        crc            <= crc16_update(crc, rx_data);

                        if ({rx_data, length_lsb} > MaxPayloadBytes) begin
                            length_error <= 1'b1;
                            packet_error <= 1'b1;
                            state        <= WaitSync0;
                        end
                        else if ({rx_data, length_lsb} == 16'h0000) state <= ReadCrc0;
                        else state <= ReadPayload;
                    end

                    ReadPayload: begin
                        payload_data[payload_index] <= rx_data;
                        crc                         <= crc16_update(crc, rx_data);

                        if (payload_index == payload_length - 1) begin
                            payload_index <= 16'h0000;
                            state         <= ReadCrc0;
                        end
                        else payload_index <= payload_index + 1'b1;
                    end

                    ReadCrc0: begin
                        received_crc_lsb <= rx_data;
                        state            <= ReadCrc1;
                    end

                    ReadCrc1: begin
                        if ({rx_data, received_crc_lsb} == crc) packet_valid <= 1'b1;
                        else begin
                            crc_error    <= 1'b1;
                            packet_error <= 1'b1;
                        end

                        state <= WaitSync0;
                    end

                    default: state <= WaitSync0;

                endcase
            end
        end
    end

endmodule
