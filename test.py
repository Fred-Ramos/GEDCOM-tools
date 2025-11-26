with open('node.ftt', 'r') as file:
    content = file.read()
    print(repr(content))  # This will show escape sequences like \t, \n, etc.
