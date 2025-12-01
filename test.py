import requests
import os
import json
import re
from dotenv import load_dotenv

def extract_json_from_response(text):
    """Extract JSON array from AI response which might have markdown and text"""
    # Try to parse directly first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Look for JSON array in markdown code blocks
    json_pattern = r'```(?:json)?\s*(\[.*\])\s*```'
    match = re.search(json_pattern, text, re.DOTALL)
    
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Look for any JSON array in the text
    json_pattern2 = r'(\[\s*\{.*\}\s*\])'
    match = re.search(json_pattern2, text, re.DOTALL)
    
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Last resort: try to find and parse the array manually
    lines = text.split('\n')
    json_lines = []
    in_json = False
    
    for line in lines:
        if line.strip().startswith('[') or line.strip().startswith('{'):
            in_json = True
        if in_json:
            json_lines.append(line)
        if line.strip().endswith(']') or line.strip().endswith('}'):
            in_json = False
    
    if json_lines:
        try:
            return json.loads('\n'.join(json_lines))
        except json.JSONDecodeError:
            pass
    
    return None

def chunk_individuals(individuals, chunk_size=5):
    """Group individuals into chunks of specified size"""
    return [individuals[i:i + chunk_size] for i in range(0, len(individuals), chunk_size)]

def process_json_file(json_file):
    load_dotenv()
    api_key = os.getenv('KEY')
    
    if not api_key:
        print("Add OpenRouter API key to .env file")
        return

    # Read prompt - make it very clear about format
    with open('prompt.txt', 'r', encoding='utf-8') as f:
        prompt = f.read()
    
    # Add strict format instruction to prompt
    strict_prompt = prompt + "\n\nIMPORTANT: Return ONLY the JSON array, no explanations, no markdown, no backticks, no additional text."
    
    # Load JSON data
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return
    
    # Extract individuals list
    if "INDI" not in data:
        print("Error: No INDI field found in JSON")
        return
    
    individuals = data["INDI"]
    chunks = chunk_individuals(individuals, 5)  # Reduced to 5 for testing
    
    print(f"Found {len(individuals)} individuals, processing in {len(chunks)} chunks")
    
    modified_individuals = []
    
    for i, chunk in enumerate(chunks):
        print(f"\n=== Processing chunk {i+1}/{len(chunks)} with {len(chunk)} individuals ===")
        
        # Prepare chunk as JSON string
        chunk_json = json.dumps(chunk, ensure_ascii=False, indent=2)
        
        # Print first 200 chars of request for debugging
        print(f"Request preview: {chunk_json[:200]}...")
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://github.com/gedcom-tools",
                "X-Title": "GEDCOM Processor"
            },
            json={
                "model": "deepseek/deepseek-chat",
                "messages": [{
                    "role": "user", 
                    "content": f"{strict_prompt}\n\nProcess these {len(chunk)} individuals:\n{chunk_json}"
                }]
            }
        )

        if response.status_code == 200:
            result = response.json()
            processed_text = result['choices'][0]['message']['content']
            
            # Print raw response for debugging
            print(f"Raw response (first 500 chars):\n{processed_text[:500]}\n...")
            
            # Extract JSON from response
            processed_chunk = extract_json_from_response(processed_text)
            
            if processed_chunk and isinstance(processed_chunk, list):
                modified_individuals.extend(processed_chunk)
                print(f"✓ Success - parsed {len(processed_chunk)} individuals")
                
                # EXTREME DEBUG: Print entire JSON of first 2 individuals
                print(f"\n=== FULL DEBUG Chunk {i+1} (first 2 individuals) ===")
                for j in range(min(2, len(processed_chunk))):
                    print(f"\nIndividual {j} FULL JSON:")
                    print(json.dumps(processed_chunk[j], ensure_ascii=False, indent=2))

            else:
                print(f"✗ Failed to parse JSON from response")
                print(f"Using original {len(chunk)} individuals")
                modified_individuals.extend(chunk)
                
                # Save problematic response for debugging
                with open(f"error_chunk_{i+1}.txt", "w", encoding="utf-8") as f:
                    f.write(f"Request:\n{chunk_json}\n\nResponse:\n{processed_text}")
                
        else:
            print(f"✗ HTTP Error {response.status_code}")
            print(f"Response: {response.text[:200]}")
            print(f"Using original {len(chunk)} individuals")
            modified_individuals.extend(chunk)
    
    # Replace INDI array with modified individuals
    data["INDI"] = modified_individuals
    
    # Save output
    output_file = json_file.replace('.json', '_processed.json') if json_file.endswith('.json') else 'output.json'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Done! Processed {len(modified_individuals)} individuals.")
    print(f"Saved to {output_file}")

if __name__ == "__main__":
    json_file = input("Enter JSON file name: ").strip()
    if not json_file.endswith('.json'):
        json_file += '.json'
    
    if os.path.exists(json_file):
        process_json_file(json_file)
    else:
        print("File not found")