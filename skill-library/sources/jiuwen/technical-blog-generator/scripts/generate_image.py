#!/usr/bin/env python3
"""
图片生成脚本 - 用于 technical-blog-generator 技能
检查配置中的图片生成 API 并调用生成图片

使用方法:
    python generate_image.py --prompt "图片描述" --output "输出路径" [--size "1024x1024"]
    python generate_image.py --check

参数:
    --prompt: 图片生成提示词（必填，可以是帖子原文或摘要，由外部 agent 决定）
    --output: 输出图片保存路径（必填）
    --size: 图片尺寸，默认 1024x1024
    --check: 仅检查 API 配置是否可用

注意:
    - 脚本不做任何提示词预处理，直接传入原始内容
    - 传入的是帖子原文还是摘要，由外部 agent 决定
"""

import argparse
import base64
import json
import os
import sys
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 配置文件路径
CONFIG_DIR = os.path.expanduser("~/.jiuwenswarm/config")
ENV_FILE = os.path.join(CONFIG_DIR, ".env")


# ============================================================================
# API 配置和调用模块
# ============================================================================

def load_env_config():
    """从 .env 文件加载图片生成 API 配置"""
    config = {}
    
    if not os.path.exists(ENV_FILE):
        return None
    
    with open(ENV_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                config[key] = value
    
    # 检查是否有图片生成相关配置
    image_config = {}
    
    # 方式1: IMAGE_GEN_API 配置 (DashScope 等)
    if config.get('IMAGE_GEN_API_KEY') and config.get('IMAGE_GEN_API_BASE'):
        image_config = {
            'api_base': config.get('IMAGE_GEN_API_BASE'),
            'api_key': config.get('IMAGE_GEN_API_KEY'),
            'model': config.get('IMAGE_GEN_MODEL_NAME', 'qwen-image-max'),
            'provider': config.get('IMAGE_GEN_PROVIDER', 'DashScope')
        }
    # 方式2: VISION_API 配置 (ModelArts 等)
    elif config.get('VISION_API_KEY') and config.get('VISION_API_BASE'):
        image_config = {
            'api_base': config.get('VISION_API_BASE'),
            'api_key': config.get('VISION_API_KEY'),
            'model': config.get('VISION_MODEL_NAME', 'qwen-image'),
            'provider': config.get('VISION_PROVIDER', 'OpenAI')
        }
    
    if not image_config.get('api_key') or not image_config.get('api_base'):
        return None
    
    return image_config


def check_image_gen_available():
    """检查图片生成 API 是否可用"""
    config = load_env_config()
    if config is None:
        return {
            'available': False,
            'reason': '未找到图片生成 API 配置，请检查 .env 文件中的 IMAGE_GEN_API_KEY/IMAGE_GEN_API_BASE 或 VISION_API_KEY/VISION_API_BASE'
        }
    
    return {
        'available': True,
        'config': config,
        'reason': f'已配置图片生成 API: {config["provider"]} - {config["model"]}'
    }


def generate_image(prompt, output_path, size='1024x1024'):
    """
    调用图片生成 API 生成图片
    
    参数:
        prompt: 图片描述（帖子原文或摘要，由外部 agent 决定）
        output_path: 输出路径
        size: 图片尺寸
    
    返回:
        dict: {'success': bool, 'path': str, 'error': str, 'prompt': str}
    """
    # 检查配置
    check_result = check_image_gen_available()
    if not check_result['available']:
        return {
            'success': False,
            'error': check_result['reason']
        }
    
    config = check_result['config']
    
    # 构建请求
    headers = {
        'Authorization': f'Bearer {config["api_key"]}',
        'Content-Type': 'application/json'
    }
    
    # 根据不同的 provider 构建请求体
    if config['provider'] == 'DashScope':
        # DashScope 格式
        data = {
            'model': config['model'],
            'input': {
                'prompt': prompt
            },
            'parameters': {
                'size': size,
                'n': 1
            }
        }
        url = config['api_base']
        if not url.endswith('/generations'):
            url = url.rstrip('/') + '/services/aigc/text2image/image-synthesis'
    else:
        # OpenAI 兼容格式 (ModelArts 等)
        data = {
            'model': config['model'],
            'prompt': prompt,
            'n': 1,
            'size': size
        }
        url = config['api_base']
        if not url.endswith('/generations'):
            url = url.rstrip('/') + '/generations'
    
    try:
        print(f'正在调用图片生成 API: {config["provider"]} - {config["model"]}')
        print(f'提示词: {prompt[:100]}...' if len(prompt) > 100 else f'提示词: {prompt}')
        
        response = requests.post(
            url,
            headers=headers,
            json=data,
            timeout=120,
            verify=False
        )
        
        print(f'状态码: {response.status_code}')
        
        if response.status_code != 200:
            return {
                'success': False,
                'error': f'API 返回错误: {response.status_code} - {response.text[:500]}',
                'prompt': prompt
            }
        
        result = response.json()
        
        # 解析响应
        if 'output' in result and 'results' in result['output']:
            # DashScope 格式
            img_data = result['output']['results'][0]
            if 'url' in img_data:
                img_url = img_data['url']
                img_response = requests.get(img_url, timeout=30, verify=False)
                if img_response.status_code == 200:
                    with open(output_path, 'wb') as f:
                        f.write(img_response.content)
                else:
                    return {'success': False, 'error': f'下载图片失败: {img_response.status_code}'}
            elif 'b64_image' in img_data:
                img_bytes = base64.b64decode(img_data['b64_image'])
                with open(output_path, 'wb') as f:
                    f.write(img_bytes)
        
        elif 'data' in result and len(result['data']) > 0:
            # OpenAI 兼容格式
            img_data = result['data'][0]
            if img_data.get('url'):
                img_url = img_data['url']
                img_response = requests.get(img_url, timeout=30, verify=False)
                if img_response.status_code == 200:
                    with open(output_path, 'wb') as f:
                        f.write(img_response.content)
                else:
                    return {'success': False, 'error': f'下载图片失败: {img_response.status_code}'}
            elif img_data.get('b64_json'):
                b64_data = img_data['b64_json']
                if b64_data.startswith('data:image'):
                    b64_data = b64_data.split(',', 1)[1]
                img_bytes = base64.b64decode(b64_data)
                with open(output_path, 'wb') as f:
                    f.write(img_bytes)
        else:
            return {
                'success': False,
                'error': f'无法解析 API 响应格式: {json.dumps(result, ensure_ascii=False)[:500]}',
                'prompt': prompt
            }
        
        # 验证文件是否生成
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f'图片已保存: {output_path} ({file_size} bytes)')
            return {
                'success': True,
                'path': output_path,
                'size': file_size,
                'prompt': prompt
            }
        else:
            return {'success': False, 'error': '图片文件未生成'}
    
    except requests.exceptions.Timeout:
        return {'success': False, 'error': 'API 请求超时'}
    except requests.exceptions.RequestException as e:
        return {'success': False, 'error': f'网络请求错误: {str(e)}'}
    except Exception as e:
        return {'success': False, 'error': f'生成图片时发生错误: {str(e)}'}


def main():
    parser = argparse.ArgumentParser(description='图片生成脚本')
    parser.add_argument('--prompt', help='图片生成提示词（帖子原文或摘要，由外部 agent 决定）')
    parser.add_argument('--output', help='输出图片路径')
    parser.add_argument('--size', default='1024x1024', help='图片尺寸')
    parser.add_argument('--check', action='store_true', help='仅检查 API 配置是否可用')

    args = parser.parse_args()

    # 如果是检查模式
    if args.check:
        result = check_image_gen_available()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    # 生成图片模式需要 prompt 和 output
    if not args.prompt or not args.output:
        parser.error('生成图片需要 --prompt 和 --output 参数')
    
    # 确保输出目录存在
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # 生成图片
    result = generate_image(args.prompt, args.output, args.size)
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if not result['success']:
        sys.exit(1)


if __name__ == '__main__':
    main()