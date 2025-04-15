module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = local.cluster_name
  cluster_version = "1.31"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  # Optional: Adds the current caller identity as an administrator via cluster access entry
  enable_cluster_creator_admin_permissions = true
  eks_managed_node_group_defaults = {
    ami_type = "AL2_x86_64"
  }
  
  eks_managed_node_groups = {
    one = {
      desired_size = 2
      max_size     = 3
      min_size     = 1

      instance_type = "t3.medium"
      name          = "ipfs-eks"

      tags = {
        Name        = "ipfs-eks-master"
        Environment = "dev"
        Terraform   = "true"
      }
    }
    two = {
      desired_size = 2
      max_size     = 3
      min_size     = 1

      instance_type = "t3.medium"
      name          = "ipfs-eks-workers"

      tags = {
        Name        = "ipfs-eks"
        Environment = "dev"
        Terraform   = "true"
      }
    }
  }
  tags = {
    Environment = "dev"
    Terraform   = "true"
  }
}
