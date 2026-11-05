import base64
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ACCEPT = ', '.join(['application/vnd.oci.image.index.v1+json', 'application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json', 'application/vnd.docker.distribution.manifest.v2+json'])


def fetch(url, headers, missing=False):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
            return json.load(response), response.headers.get('Docker-Content-Digest', '')
    except urllib.error.HTTPError as error:
        status = error.code
        error.close()
        if missing and status == 404:
            return None, ''
        raise RuntimeError(f'Registry request failed (HTTP {status})') from None


def registry(image):
    if not re.fullmatch(r'ghcr\.io/[a-z0-9_.-]+/[a-z0-9_.-]+', image):
        raise ValueError('Expected a GHCR image repository')
    repository = image.removeprefix('ghcr.io/')
    credentials = base64.b64encode(f"{os.environ['REGISTRY_USER']}:{os.environ['REGISTRY_PASSWORD']}".encode()).decode()
    query = urllib.parse.urlencode({'service': 'ghcr.io', 'scope': f'repository:{repository}:pull'})
    auth, _ = fetch('https://ghcr.io/token?' + query, {'Authorization': 'Basic ' + credentials})
    return 'https://ghcr.io/v2/' + repository + '/', {'Authorization': 'Bearer ' + auth['token'], 'Accept': ACCEPT}


def write_output(**values):
    with open(os.environ['GITHUB_OUTPUT'], 'a') as file:
        for key, value in values.items():
            file.write(f'{key}={value}\n')


def main():
    action, image, tag, *args = sys.argv[1:]
    if not re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-rc\.(0|[1-9][0-9]*))?', tag) or len(tag) > 128:
        raise ValueError('Expected vX.Y.Z or vX.Y.Z-rc.N')
    base, headers = registry(image)
    existing, digest = fetch(base + 'manifests/' + tag, headers, missing=True)
    if action != 'merge' or len(args) != 1:
        raise ValueError('Usage: image-manifest.py merge IMAGE TAG DIRECTORY')
    references = [Path(args[0], arch + '.txt').read_text().strip() for arch in ('amd64', 'arm64')]
    for reference in references:
        if not re.fullmatch(re.escape(image) + r'@sha256:[0-9a-f]{64}', reference):
            raise ValueError('Invalid verified image reference')
    if existing is not None:
        if any(reference != image + '@' + digest for reference in references):
            raise ValueError('Version already exists with another digest. Publish a new version.')
    else:
        for arch, reference in zip(('amd64', 'arm64'), references):
            manifest, _ = fetch(base + 'manifests/' + reference.split('@')[1], headers)
            config_digest = manifest.get('config', {}).get('digest', '')
            if not re.fullmatch(r'sha256:[0-9a-f]{64}', config_digest):
                raise ValueError('Expected a verified single-platform image')
            config, _ = fetch(base + 'blobs/' + config_digest, headers)
            if config.get('os') != 'linux' or config.get('architecture') != arch or config.get('config', {}).get('Labels', {}).get('org.opencontainers.image.version') != tag[1:]:
                raise ValueError('Verified image architecture or version does not match')
        subprocess.run(['docker', 'buildx', 'imagetools', 'create', '--tag', image + ':' + tag, *references], check=True)
        existing, digest = fetch(base + 'manifests/' + tag, headers)
    platforms = {(entry.get('platform', {}).get('os'), entry.get('platform', {}).get('architecture')) for entry in existing.get('manifests', [])}
    if not {('linux', 'amd64'), ('linux', 'arm64')}.issubset(platforms):
        raise ValueError('Release must include AMD64 and ARM64; use a new version for older single-platform releases')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
        raise ValueError('Registry did not return a valid release digest')
    write_output(reference=image + '@' + digest)


if __name__ == '__main__':
    main()
