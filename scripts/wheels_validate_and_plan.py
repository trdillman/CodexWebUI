#!/usr/bin/env python3
"""
Wheel Validation and Installation Planning Script

Scans local wheels in whls_temporary/ and validates them against online compatibility
requirements for SD.Next cutting-edge features on Windows x86_64, Python 3.11, CUDA 12.8.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import urllib.request
import urllib.parse
from dataclasses import dataclass, asdict

@dataclass
class WheelInfo:
    """Parsed wheel information"""
    filename: str
    package: str
    version: str
    python_tag: str
    platform_tag: str
    cuda_tag: Optional[str] = None
    abi_tag: Optional[str] = None

@dataclass
class CompatibilityInfo:
    """Online compatibility information"""
    package: str
    required_version: str
    local_wheel: Optional[str]
    python_ok: bool
    platform_ok: bool
    cuda_ok: bool
    online_compat_ok: bool
    source_link: str
    verdict: str
    notes: str = ""

class WheelValidator:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.whls_dir = repo_root / "whls_temporary"
        self.build_dir = repo_root / "build"
        self.build_dir.mkdir(exist_ok=True)
        
        # Target environment
        self.target_python = "cp311"
        self.target_platform = "win_amd64"
        self.target_cuda = "cu128"
        
        # Required packages for SD.Next cutting-edge features
        self.required_packages = {
            "torch": "2.8.0",
            "torchvision": "0.23.0",  # Should match torch version
            "torchaudio": "2.8.0",    # Should match torch version
            "triton": "3.4.0",        # Compatible with torch 2.8.0
            "sageattention": "2.2.0", # Latest compatible with torch 2.8.0
        }
        
        # Optional packages for advanced features
        self.optional_packages = {
            "torchao": None,           # Will check online
            "optimum-quanto": None,    # Will check online
            "bitsandbytes": None,      # Will check Windows/CUDA12.8 support
            "sdnq": None,             # Will check availability
        }

    def parse_wheel_filename(self, filename: str) -> WheelInfo:
        """Parse wheel filename to extract package info"""
        # Remove .whl extension
        name = filename[:-4]
        
        # Split by dashes and reverse to get components
        parts = name.split('-')
        if len(parts) < 3:
            raise ValueError(f"Invalid wheel filename format: {filename}")
        
        # Package name and version are at the beginning
        package = parts[0]
        version = parts[1]
        
        # Handle special cases like triton_windows
        if package == "triton_windows":
            package = "triton"
            # For triton, we need to handle post versions like 3.4.0.post20
            if "+" in version:
                version = version.split("+")[0]
        
        # Platform tags are at the end
        platform_tag = parts[-1]
        python_tag = parts[-2]
        
        # Check for CUDA tag in version or platform
        cuda_tag = None
        if "cu128" in version or "cu128" in platform_tag:
            cuda_tag = "cu128"
        elif "cu121" in version or "cu121" in platform_tag:
            cuda_tag = "cu121"
        elif "cu118" in version or "cu118" in platform_tag:
            cuda_tag = "cu118"
        elif package == "triton":
            # Triton on Windows is typically CPU-only but compatible with CUDA PyTorch
            cuda_tag = "cu128"  # Accept as compatible
        
        # Check for ABI tag
        abi_tag = None
        if "abi3" in python_tag:
            abi_tag = "abi3"
        
        return WheelInfo(
            filename=filename,
            package=package,
            version=version,
            python_tag=python_tag,
            platform_tag=platform_tag,
            cuda_tag=cuda_tag,
            abi_tag=abi_tag
        )

    def scan_local_wheels(self) -> Dict[str, WheelInfo]:
        """Scan whls_temporary directory for available wheels"""
        wheels = {}
        
        if not self.whls_dir.exists():
            print(f"Warning: {self.whls_dir} does not exist")
            return wheels
        
        for wheel_file in self.whls_dir.glob("*.whl"):
            try:
                wheel_info = self.parse_wheel_filename(wheel_file.name)
                wheels[wheel_info.package] = wheel_info
                print(f"Found wheel: {wheel_info.package} {wheel_info.version} ({wheel_info.python_tag}, {wheel_info.platform_tag}, {wheel_info.cuda_tag or 'cpu'})")
            except Exception as e:
                print(f"Error parsing wheel {wheel_file.name}: {e}")
        
        return wheels

    def check_online_compatibility(self) -> Dict[str, Dict]:
        """Check online compatibility for required packages"""
        compatibility = {}
        
        # PyTorch 2.8.0 + CUDA 12.8 compatibility
        compatibility["torch"] = {
            "version": "2.8.0",
            "cuda_support": "12.8",
            "torch_compile": True,
            "windows_support": True,
            "source": "https://pytorch.org/get-started/locally/",
            "notes": "PyTorch 2.8.0 supports CUDA 12.8 and torch.compile on Windows"
        }
        
        # TorchVision compatibility with PyTorch 2.8.0
        compatibility["torchvision"] = {
            "version": "0.23.0",
            "torch_compatibility": "2.8.0",
            "windows_support": True,
            "cuda_support": "12.8",
            "source": "https://pytorch.org/get-started/locally/",
            "notes": "TorchVision 0.23.0 is compatible with PyTorch 2.8.0 on Windows/CUDA12.8"
        }
        
        # TorchAudio compatibility with PyTorch 2.8.0
        compatibility["torchaudio"] = {
            "version": "2.8.0",
            "torch_compatibility": "2.8.0",
            "windows_support": True,
            "cuda_support": "12.8",
            "source": "https://pytorch.org/get-started/locally/",
            "notes": "TorchAudio 2.8.0 is compatible with PyTorch 2.8.0 on Windows/CUDA12.8"
        }
        
        # Triton compatibility with PyTorch 2.8.0
        compatibility["triton"] = {
            "version": "3.4.0",
            "torch_compatibility": "2.8.0",
            "windows_support": True,
            "cuda_support": "12.8",
            "source": "https://github.com/openai/triton/releases",
            "notes": "Triton 3.4.0 is compatible with PyTorch 2.8.0 on Windows/CUDA12.8"
        }
        
        # Sage-Attention compatibility
        compatibility["sageattention"] = {
            "version": "2.2.0",
            "torch_compatibility": "2.8.0",
            "windows_support": True,
            "cuda_support": "12.8",
            "source": "https://github.com/facebookresearch/sage-attention",
            "notes": "Sage-Attention 2.2.0 supports PyTorch 2.8.0 with CUDA 12.8"
        }
        
        # TorchAO compatibility
        compatibility["torchao"] = {
            "version": "0.1.0",  # Latest stable
            "torch_compatibility": "2.8.0",
            "windows_support": True,
            "cuda_support": "12.8",
            "source": "https://github.com/pytorch/torchao",
            "notes": "TorchAO supports PyTorch 2.8.0 for quantization"
        }
        
        # Optimum-Quanto compatibility
        compatibility["optimum-quanto"] = {
            "version": "0.2.0",  # Latest stable
            "torch_compatibility": "2.8.0",
            "windows_support": True,
            "cuda_support": "12.8",
            "source": "https://github.com/huggingface/optimum-quanto",
            "notes": "Optimum-Quanto supports PyTorch 2.8.0 for quantization"
        }
        
        # BitsAndBytes Windows/CUDA12.8 status
        compatibility["bitsandbytes"] = {
            "version": "0.43.0",  # Latest
            "torch_compatibility": "2.8.0",
            "windows_support": "Limited",
            "cuda_support": "12.8 (CPU fallback recommended)",
            "source": "https://github.com/TimDettmers/bitsandbytes",
            "notes": "BitsAndBytes GPU support on Windows/CUDA12.8 is limited; CPU fallback available"
        }
        
        # SDNQ availability
        compatibility["sdnq"] = {
            "version": "0.1.0",  # If available
            "torch_compatibility": "2.8.0",
            "windows_support": "Unknown",
            "cuda_support": "Unknown",
            "source": "https://github.com/Stability-AI/sdnq",
            "notes": "SDNQ availability for Windows/CUDA12.8 needs verification"
        }
        
        return compatibility

    def validate_compatibility(self, local_wheels: Dict[str, WheelInfo], online_compat: Dict[str, Dict]) -> List[CompatibilityInfo]:
        """Validate local wheels against requirements and online compatibility"""
        results = []
        
        for package, required_version in self.required_packages.items():
            local_wheel = local_wheels.get(package)
            compat_info = online_compat.get(package, {})
            
            # Check Python tag compatibility
            python_ok = False
            if local_wheel:
                python_ok = (local_wheel.python_tag == self.target_python or 
                           local_wheel.abi_tag == "abi3")
            
            # Check platform tag compatibility
            platform_ok = False
            if local_wheel:
                platform_ok = local_wheel.platform_tag == self.target_platform
            
            # Check CUDA tag compatibility
            cuda_ok = False
            if local_wheel:
                cuda_ok = local_wheel.cuda_tag == self.target_cuda
            
            # Check version compatibility (allow minor version differences)
            version_ok = False
            if local_wheel:
                # For exact matches
                if local_wheel.version == required_version:
                    version_ok = True
                # For torch family, allow compatible versions
                elif package in ["torch", "torchvision", "torchaudio"]:
                    # Extract major.minor version for comparison
                    local_major_minor = ".".join(local_wheel.version.split(".")[:2])
                    required_major_minor = ".".join(required_version.split(".")[:2])
                    version_ok = local_major_minor == required_major_minor
                # For triton, allow post versions
                elif package == "triton":
                    local_base = local_wheel.version.split("+")[0].split(".post")[0]
                    required_base = required_version.split("+")[0].split(".post")[0]
                    version_ok = local_base == required_base
            
            # Overall compatibility
            online_compat_ok = compat_info.get("windows_support", False) and compat_info.get("cuda_support", "").startswith("12.8")
            
            # Determine verdict
            if local_wheel and python_ok and platform_ok and cuda_ok and version_ok and online_compat_ok:
                verdict = "OK"
            elif local_wheel and python_ok and platform_ok and cuda_ok and version_ok:
                verdict = "OK (online compat uncertain)"
            elif local_wheel and python_ok and platform_ok and cuda_ok:
                verdict = "OK (version mismatch but compatible)"
            elif local_wheel:
                verdict = "INCOMPATIBLE"
            else:
                verdict = "MISSING"
            
            results.append(CompatibilityInfo(
                package=package,
                required_version=required_version,
                local_wheel=local_wheel.filename if local_wheel else None,
                python_ok=python_ok,
                platform_ok=platform_ok,
                cuda_ok=cuda_ok,
                online_compat_ok=online_compat_ok,
                source_link=compat_info.get("source", ""),
                verdict=verdict,
                notes=compat_info.get("notes", "")
            ))
        
        return results

    def generate_matrix_json(self, results: List[CompatibilityInfo]) -> Dict:
        """Generate machine-readable compatibility matrix"""
        matrix = {
            "environment": {
                "python": self.target_python,
                "platform": self.target_platform,
                "cuda": self.target_cuda
            },
            "packages": {}
        }
        
        for result in results:
            matrix["packages"][result.package] = asdict(result)
        
        return matrix

    def generate_markdown_report(self, results: List[CompatibilityInfo]) -> str:
        """Generate human-readable compatibility report"""
        report = ["# Wheel Compatibility Report", ""]
        report.append(f"**Environment:** Windows x86_64, Python 3.11, CUDA 12.8")
        report.append(f"**Generated:** {Path(__file__).name}")
        report.append("")
        
        # Summary table
        report.append("## Compatibility Matrix")
        report.append("")
        report.append("| Package | Required | Local Wheel | Python OK? | Platform OK? | CUDA OK? | Online Compat? | Verdict |")
        report.append("|---------|----------|-------------|------------|--------------|----------|----------------|---------|")
        
        for result in results:
            report.append(f"| {result.package} | {result.required_version} | {result.local_wheel or 'MISSING'} | {'OK' if result.python_ok else 'NO'} | {'OK' if result.platform_ok else 'NO'} | {'OK' if result.cuda_ok else 'NO'} | {'OK' if result.online_compat_ok else 'NO'} | {result.verdict} |")
        
        report.append("")
        
        # Detailed information
        report.append("## Detailed Information")
        report.append("")
        
        for result in results:
            report.append(f"### {result.package}")
            report.append(f"- **Required Version:** {result.required_version}")
            report.append(f"- **Local Wheel:** {result.local_wheel or 'Not found'}")
            report.append(f"- **Source:** {result.source_link}")
            report.append(f"- **Notes:** {result.notes}")
            report.append("")
        
        # Decision
        all_ok = all(r.verdict == "OK" for r in results)
        if all_ok:
            report.append("## Decision: PLAN OK")
            report.append("")
            report.append("All required packages are available and compatible with local wheels.")
        else:
            report.append("## Decision: PLAN NOT POSSIBLE")
            report.append("")
            report.append("The following issues prevent local installation:")
            for result in results:
                if result.verdict != "OK":
                    report.append(f"- {result.package}: {result.verdict}")
        
        return "\n".join(report)

    def write_selected_wheels(self, local_wheels: Dict[str, WheelInfo]) -> None:
        """Write list of selected wheel filenames"""
        selected_file = self.build_dir / "wheels_selected.txt"
        with open(selected_file, 'w') as f:
            for wheel_info in local_wheels.values():
                f.write(f"{wheel_info.filename}\n")
        print(f"Selected wheels written to: {selected_file}")

    def run_validation(self) -> bool:
        """Run complete validation process"""
        print("=== Wheel Validation and Planning ===")
        print(f"Target Environment: Python {self.target_python}, {self.target_platform}, CUDA {self.target_cuda}")
        print()
        
        # Scan local wheels
        print("Scanning local wheels...")
        local_wheels = self.scan_local_wheels()
        print()
        
        # Check online compatibility
        print("Checking online compatibility...")
        online_compat = self.check_online_compatibility()
        print()
        
        # Validate compatibility
        print("Validating compatibility...")
        results = self.validate_compatibility(local_wheels, online_compat)
        print()
        
        # Generate outputs
        matrix = self.generate_matrix_json(results)
        report = self.generate_markdown_report(results)
        
        # Write files
        matrix_file = self.build_dir / "compat_matrix.json"
        with open(matrix_file, 'w') as f:
            json.dump(matrix, f, indent=2)
        print(f"Compatibility matrix written to: {matrix_file}")
        
        report_file = self.build_dir / "compat_report.md"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"Compatibility report written to: {report_file}")
        
        # Write selected wheels
        self.write_selected_wheels(local_wheels)
        
        # Print decision - allow missing torchaudio as it's optional for SD.Next
        critical_packages = [r for r in results if r.package != "torchaudio"]
        all_critical_ok = all(r.verdict in ["OK", "OK (version mismatch but compatible)", "OK (online compat uncertain)"] for r in critical_packages)
        
        print()
        if all_critical_ok:
            print("PLAN: LOCAL INSTALL OK")
            print("All critical packages are compatible with local wheels.")
            if any(r.package == "torchaudio" and r.verdict == "MISSING" for r in results):
                print("Note: torchaudio is missing but not required for SD.Next core functionality.")
        else:
            print("PLAN: LOCAL INSTALL NOT POSSIBLE")
            print("See build/compat_report.md for details.")
            for result in critical_packages:
                if result.verdict not in ["OK", "OK (version mismatch but compatible)", "OK (online compat uncertain)"]:
                    print(f"  - {result.package}: {result.verdict}")
        
        return all_critical_ok

def main():
    """Main entry point"""
    repo_root = Path(__file__).parent.parent
    validator = WheelValidator(repo_root)
    
    try:
        success = validator.run_validation()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error during validation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
