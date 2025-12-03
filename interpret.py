import requests
import os
import json
import re
from dotenv import load_dotenv

from gedcom_tools.converter import json_to_gedcom

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
    
    chunks = chunk_individuals(individuals, 10)  # Adjust chunk size as needed
    
    print(f"Found {len(individuals)} individuals, processing in {len(chunks)} chunks")
    
    processed_individuals = []  # Initialize list to store processed individuals
    
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
            print(f"Raw response:\n{processed_text}\n...")
            
            # Since the response is already a JSON array, we can skip extraction
            try:
                processed_chunk = json.loads(processed_text)  # Directly parse the response
                if isinstance(processed_chunk, list):
                    processed_individuals.extend(processed_chunk)
                    print(f"✓ Success - parsed {len(processed_chunk)} individuals")
                else:
                    print(f"✗ Invalid response format. Expected list, got {type(processed_chunk)}")
                    processed_individuals.extend(chunk)  # Keep the original individuals if there's an issue
            except json.JSONDecodeError:
                print(f"✗ Failed to parse JSON from response")
                processed_individuals.extend(chunk)  # Keep the original individuals in case of error

                # Save problematic response for debugging
                with open(f"error_chunk_{i+1}.txt", "w", encoding="utf-8") as f:
                    f.write(f"Request:\n{chunk_json}\n\nResponse:\n{processed_text}")
                
        else:
            print(f"✗ HTTP Error {response.status_code}")
            print(f"Response: {response.text[:200]}")
            processed_individuals.extend(chunk)  # Keep the original individuals
    
    # Replace INDI array with processed individuals
    data["INDI"] = processed_individuals
    
    # Print the modified individuals (on the way out)
    print("\n=== Modified Individuals (on the way out) ===")
    print(json.dumps(processed_individuals, ensure_ascii=False, indent=2))
    
    # Save output
    output_file = json_file.replace('.json', '_processed.json') if json_file.endswith('.json') else 'output.json'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Done! Processed {len(processed_individuals)} individuals.")
    print(f"Saved to {output_file}")

    # Convert to GEDCOM and save
    gedcom_data = json_to_gedcom(data)  # Convert the processed JSON to GEDCOM format
    
    gedcom_file = output_file.replace('.json', '.ged')  # Create GEDCOM file name
    with open(gedcom_file, 'w', encoding='utf-8') as f:
        f.write(gedcom_data)  # Write the GEDCOM data to a file
    
    print(f"✅ GEDCOM file saved to {gedcom_file}")


if __name__ == "__main__":
    json_file = input("Enter JSON file name: ").strip()
    if not json_file.endswith('.json'):
        json_file += '.json'
    
    if os.path.exists(json_file):
        process_json_file(json_file)
    else:
        print("File not found")