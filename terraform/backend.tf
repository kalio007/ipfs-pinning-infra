terraform {
  backend "s3" {
    bucket = "kalio-ipfs-infra"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}
