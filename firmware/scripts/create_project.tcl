# Create Vivado project for Nexys A7-100T logic analyzer project

set script_dir [file dirname [file normalize [info script]]]
set repo_root  [file normalize [file join $script_dir ".."]]

set project_name "logic_analyzer"
set project_dir  [file join $repo_root "build" "vivado"]
set part_name    "xc7a100tcsg324-1"

create_project $project_name $project_dir -part $part_name -force

set_property target_language VHDL [current_project]
set_property simulator_language Mixed [current_project]

add_files -norecurse [file join $repo_root "src" "top.sv"]
add_files -norecurse [file join $repo_root "src" "uart_tx.sv"]
add_files -norecurse [file join $repo_root "src" "uart_rx.sv"]

add_files -fileset constrs_1 [file join $repo_root "constraints" "nexys_a7_100t.xdc"]
add_files -fileset sim_1 [file join $repo_root "tb" "uart_tx_tb.sv"]
set_property top uart_tx_tb [get_filesets sim_1]
add_files -fileset constrs_1 [file join $repo_root "constraints" "nexys_a7_100t.xdc"]

set_property top top [current_fileset]

update_compile_order -fileset sources_1

puts "Vivado project created successfully."
puts "Project location: $project_dir"
