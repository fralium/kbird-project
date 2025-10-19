#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import sys
import os

def read_csv_file(filename):
    """读取CSV文件，尝试不同编码"""
    species = set()
    species_map = {}
    
    encodings = ['utf-8', 'gbk', 'gb2312', 'latin1']
    
    for encoding in encodings:
        try:
            with open(filename, 'r', encoding=encoding) as file:
                lines = file.readlines()
                print(f"成功使用 {encoding} 编码读取 {filename}")
                break
        except UnicodeDecodeError:
            continue
    else:
        print(f"无法读取文件 {filename}")
        return None, None
    
    for line_num, line in enumerate(lines, 1):
        line = line.strip()
        if line and not line.startswith('#'):
            parts = line.split(',')
            if len(parts) >= 2:
                latin_name = parts[0].strip()
                chinese_name = parts[1].strip()
                
                if latin_name and chinese_name:
                    species.add(latin_name)
                    species_map[latin_name] = {
                        'chinese_name': chinese_name,
                        'line_number': line_num,
                        'full_line': line
                    }
    
    return species, species_map

def compare_csv_files():
    """对比两个CSV文件"""
    print("=== CSV文件对比工具 ===\n")
    
    file1 = '1502fix.csv'
    file2 = '1508.csv'
    
    if not os.path.exists(file1):
        print(f"文件不存在: {file1}")
        return
    
    if not os.path.exists(file2):
        print(f"文件不存在: {file2}")
        return
    
    print(f"读取文件: {file1}")
    species1, species_map1 = read_csv_file(file1)
    if species1 is None:
        return
    
    print(f"读取文件: {file2}")
    species2, species_map2 = read_csv_file(file2)
    if species2 is None:
        return
    
    print(f"\n文件统计:")
    print(f"{file1}: {len(species1)} 个物种")
    print(f"{file2}: {len(species2)} 个物种")
    
    # 找出新增的物种
    new_species = []
    for latin_name in species2:
        if latin_name not in species1:
            species_info = species_map2[latin_name]
            new_species.append({
                'latin_name': latin_name,
                'chinese_name': species_info['chinese_name'],
                'line_number': species_info['line_number']
            })
    
    print(f"\n=== 对比结果 ===")
    print(f"新增物种数量: {len(new_species)}")
    print(f"物种数量变化: +{len(new_species)}")
    
    if new_species:
        print(f"\n=== 新增物种列表 ===")
        for i, species in enumerate(new_species, 1):
            print(f"{i:2d}. {species['latin_name']} - {species['chinese_name']} (第{species['line_number']}行)")
        
        # 保存新增物种到文件
        with open('new-species-utf8.csv', 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            for species in new_species:
                writer.writerow([species['latin_name'], species['chinese_name']])
        
        print(f"\n新增物种已保存到: new-species-utf8.csv")
    
    print(f"\n=== 对比完成 ===")

if __name__ == "__main__":
    compare_csv_files()






