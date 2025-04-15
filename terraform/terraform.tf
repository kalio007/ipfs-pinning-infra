terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.7.1"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0.4"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.13.0"
    }
    cloudinit = {
      source  = "hashicorp/cloudinit"
      version = "2.3.7-alpha.2"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.36.0"
    }
  }
  required_version = ">= 1.6.3"
}
