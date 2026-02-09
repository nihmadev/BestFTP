pub fn format_bytes(bytes: u64) -> String {
    const SUFFIXES: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    if bytes == 0 { return "0 B".to_string(); }
    
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < SUFFIXES.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    if unit_index == 0 {
        format!("{} {}", bytes, SUFFIXES[unit_index])
    } else {
        let formatted = if size >= 10.0 {
            format!("{:.1} {}", size, SUFFIXES[unit_index])
        } else {
            format!("{:.2} {}", size, SUFFIXES[unit_index])
        };
        formatted
    }
}

pub fn parse_ftp_list_line(line: &str) -> Option<(String, u64, bool, String, String)> {
    if line.contains('=') && line.contains(';') {
        let size;
        let is_directory;
        let mut date_str = String::new();
        
        let parts: Vec<&str> = line.split(';').collect();
        if parts.len() >= 2 {
            let name = parts.last().unwrap().trim();
            let mut temp_size = 0;
            let mut temp_is_dir = false;
            
            for i in 0..parts.len()-1 {
                let fact = parts[i].trim();
                if let Some((key, value)) = fact.split_once('=') {
                    match key.to_lowercase().as_str() {
                        "type" => {
                            if value.to_lowercase() == "dir" || value.to_lowercase() == "pdir" || value.to_lowercase() == "cdir" {
                                temp_is_dir = true;
                            }
                        },
                        "size" => {
                            let parsed_size = value.parse::<u64>().unwrap_or(0);
                            if !temp_is_dir && parsed_size > 100 * 1024 * 1024 {
                                println!("DEBUG: Large file detected in FTP: {} size: {}", name, parsed_size);
                            }
                            temp_size = parsed_size;
                        },
                        "modify" => {
                            if value.len() == 14 {
                                if let (Ok(year), Ok(month), Ok(day), Ok(hour), Ok(minute)) = (
                                    value[0..4].parse::<u32>(),
                                    value[4..6].parse::<u32>(),
                                    value[6..8].parse::<u32>(),
                                    value[8..10].parse::<u32>(),
                                    value[10..12].parse::<u32>()
                                ) {
                                    date_str = format!("{:04}-{:02}-{:02} {:02}:{:02}", year, month, day, hour, minute);
                                } else {
                                    date_str = value.to_string();
                                }
                            } else {
                                date_str = value.to_string();
                            }
                        },
                        _ => {}
                    }
                }
            }
            size = temp_size;
            is_directory = temp_is_dir;
            
            if !name.is_empty() && name != "." && name != ".." {
                return Some((name.to_string(), size, is_directory, date_str, "".to_string()));
            }
        }
    }

    None
}
