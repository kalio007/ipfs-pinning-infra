variable "region" {
  description = "value of the AWS region"
  type        = string
  default     = "us-east-1"
}
variable "clusterName" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "ipfs-eks"
}
